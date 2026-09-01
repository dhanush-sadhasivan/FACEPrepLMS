import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getAdminClient } from '@/lib/supabase/admin';
import { generateAndUploadCdnSnapshots } from '@/lib/cdn-cache';

function normalizeStatus(status?: string): 'solved' | 'attempted' | 'unattempted' {
  if (!status) return 'unattempted';
  const lower = status.toLowerCase().trim();
  if (lower === 'solved' || lower === 'accepted' || lower === 'passed' || lower === 'complete') {
    return 'solved';
  }
  if (lower === 'attempted' || lower === 'partial' || lower === 'failed' || lower === 'wrong') {
    return 'attempted';
  }
  return 'unattempted';
}

const UPSERT_BATCH_SIZE = 500;

export async function POST(request: Request) {
  const authHeader = request.headers.get('x-api-key');
  const expectedKey = process.env.SCRAPER_INGEST_API_KEY || process.env.RAILWAY_API_KEY;

  if (!expectedKey) {
    console.error('[ingest] SCRAPER_INGEST_API_KEY and RAILWAY_API_KEY are both unset. Rejecting request.');
    return NextResponse.json({ error: 'Server misconfiguration: API key not set' }, { status: 500 });
  }

  if (expectedKey && authHeader !== expectedKey) {
    console.error(`[scrape/ingest] Unauthorized: provided key "${authHeader}" does not match expected.`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // MUST use admin service role client because this call comes from external scraper without cookies!
  const supabase = getAdminClient();

  try {
    const body = await request.json();
    const { contestId, scrapedAt, results } = body;

    console.log(`[scrape/ingest] Received progress ingest for contestId=${contestId}, resultsCount=${results?.length || 0}`);

    if (!contestId || !Array.isArray(results)) {
      return NextResponse.json({ error: 'contestId and results array are required' }, { status: 400 });
    }

    // 1. Verify the contest exists
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('id, hackerrank_slug')
      .eq('id', contestId)
      .single();

    if (contestError || !contest) {
      console.error(`[scrape/ingest] Contest not found: ${contestId}. Error: ${contestError?.message}`);
      return NextResponse.json({ error: `Contest not found: ${contestId}` }, { status: 404 });
    }

    // 2. Fetch contest questions to map question slug -> question_id
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select('id, slug, order_index')
      .eq('contest_id', contestId)
      .order('order_index', { ascending: true });

    if (qError) {
      console.error(`[scrape/ingest] Failed to fetch questions: ${qError.message}`);
      return NextResponse.json({ error: qError.message }, { status: 500 });
    }

    const questionList = questions || [];
    const questionMap = new Map<string, string>();

    questionList.forEach((q: { id: string; slug: string }, idx: number) => {
      if (q.slug) {
        questionMap.set(q.slug, q.id);
        questionMap.set(q.slug.trim().toLowerCase(), q.id);
        questionMap.set(q.slug.replace(/[^a-z0-9]/gi, '').toLowerCase(), q.id);
      }
      questionMap.set(`index-${idx}`, q.id);
    });

    console.log(`[scrape/ingest] Built multi-strategy question map for contest with ${questionList.length} question(s)`);

    if (questionList.length === 0) {
      console.error(`[scrape/ingest] No questions found in DB for contest ${contestId}. Cannot map progress.`);
      return NextResponse.json({
        error: 'No questions found for this contest in the database. Scrape or create questions first.',
        ok: false,
        updated: 0,
        debug: { contestId, questionCount: 0, resultUsers: results.length },
      }, { status: 400 });
    }

    // 3. Build progress rows
    const progressRows: Array<{
      contest_id: string;
      user_id: string;
      question_id: string;
      status: 'solved' | 'attempted' | 'unattempted';
      score: number;
      max_score: number;
      last_submission_at: string | null;
      updated_at: string;
    }> = [];

    let unmappedSlugs = 0;
    let missingUserIds = 0;
    const unmappedSlugSamples: string[] = [];

    const resolveQuestionId = (slug: string, idx: number): string | undefined => {
      if (!slug) return questionMap.get(`index-${idx}`);
      const exact = questionMap.get(slug);
      if (exact) return exact;
      const lower = questionMap.get(slug.trim().toLowerCase());
      if (lower) return lower;
      const norm = questionMap.get(slug.replace(/[^a-z0-9]/gi, '').toLowerCase());
      if (norm) return norm;
      return questionMap.get(`index-${idx}`);
    };

    // Clean up old progress rows for partial-score users running in Strict Mode (where estimatedProgress === true)
    for (const userResult of results) {
      if (userResult.estimatedProgress && userResult.user_id) {
        console.log(`[scrape/ingest] Cleaning up old progress rows for partial user ${userResult.username} (user_id: ${userResult.user_id}) in contest ${contestId}...`);
        await supabase
          .from('progress')
          .delete()
          .eq('contest_id', contestId)
          .eq('user_id', userResult.user_id);
      }
    }

    results.forEach((userResult: any) => {
      const userId = userResult.user_id;
      const userQuestions = userResult.questions || [];

      if (!userId) {
        missingUserIds++;
        return;
      }

      userQuestions.forEach((qResult: any, qIdx: number) => {
        const questionId = resolveQuestionId(qResult.slug, qIdx);
        if (questionId) {
          const rawStatus = normalizeStatus(qResult.status);
          const score = Math.max(0, Math.round(parseFloat(qResult.score) || 0));
          const maxScore = Math.max(0, Math.round(parseFloat(qResult.maxScore || qResult.max_score) || 10));

          // A question is solved ONLY if full score (e.g. 10/10) is achieved
          const isSolved = (rawStatus === 'solved' || score >= maxScore) && score >= maxScore && maxScore > 0;
          const status: 'solved' | 'attempted' | 'unattempted' = isSolved
            ? 'solved'
            : (score > 0 || rawStatus === 'attempted')
            ? 'attempted'
            : 'unattempted';

          // Sparse Storage Optimization: Only insert rows for questions that are solved or attempted
          if (status !== 'unattempted' || score > 0) {
            progressRows.push({
              contest_id: contestId,
              user_id: userId,
              question_id: questionId,
              status,
              score,
              max_score: maxScore,
              last_submission_at: qResult.lastSubmissionAt || qResult.last_submission_at || null,
              updated_at: new Date().toISOString(),
            });
          }
        } else {
          unmappedSlugs++;
          if (unmappedSlugSamples.length < 5) {
            unmappedSlugSamples.push(qResult.slug);
          }
        }
      });
    });

    console.log(`[scrape/ingest] Built ${progressRows.length} progress row(s). Unmapped slugs: ${unmappedSlugs}. Missing userIds: ${missingUserIds}.`);
    if (unmappedSlugSamples.length > 0) {
      console.warn(`[scrape/ingest] Sample unmapped slugs: ${unmappedSlugSamples.join(', ')}`);
    }

    // 4. Upsert into progress table in batches
    let totalUpserted = 0;
    const errors: string[] = [];

    if (progressRows.length > 0) {
      for (let i = 0; i < progressRows.length; i += UPSERT_BATCH_SIZE) {
        const batch = progressRows.slice(i, i + UPSERT_BATCH_SIZE);
        const { error: upsertError } = await supabase
          .from('progress')
          .upsert(batch, { onConflict: 'contest_id,user_id,question_id' });

        if (upsertError) {
          console.error(`[scrape/ingest] DB Upsert error on batch ${Math.floor(i / UPSERT_BATCH_SIZE) + 1}: ${upsertError.message}`);
          errors.push(`Batch ${Math.floor(i / UPSERT_BATCH_SIZE) + 1}: ${upsertError.message}`);
        } else {
          totalUpserted += batch.length;
          console.log(`[scrape/ingest] Upserted batch ${Math.floor(i / UPSERT_BATCH_SIZE) + 1}: ${batch.length} rows`);
        }
      }
    }

    // 5. Update contest last_scraped_at timestamp & invalidate Next.js caches & CDN snapshots
    const nowIso = scrapedAt || new Date().toISOString();
    await supabase
      .from('contests')
      .update({ last_scraped_at: nowIso })
      .eq('id', contestId);

    try {
      await generateAndUploadCdnSnapshots(contestId);
      revalidatePath(`/contests/${contestId}`);
      revalidatePath('/contests');
      revalidatePath('/dashboard');
      revalidatePath('/roadmaps');
      revalidatePath('/reports');
      revalidatePath('/internal-training');

      revalidateTag('leaderboard', 'max');
      revalidateTag('global-stats', 'max');
      revalidateTag('contests', 'max');
      revalidateTag(`contest-${contestId}`, 'max');
      revalidateTag('roadmaps', 'max');
      revalidateTag('roadmap-analytics', 'max');
      revalidateTag('internal-training', 'max');
      revalidateTag('it-overview', 'max');
    } catch (revErr) {
      console.warn(`[scrape/ingest] Cache revalidation / CDN snapshot warning:`, revErr);
    }

    if (errors.length > 0) {
      console.error(`[scrape/ingest] Completed with ${errors.length} batch error(s). Upserted: ${totalUpserted}/${progressRows.length}`);
      return NextResponse.json({
        ok: false,
        error: `Partial failure: ${errors.join('; ')}`,
        updated: totalUpserted,
        total: progressRows.length,
        unmappedSlugs,
      }, { status: 207 });
    }

    console.log(`[scrape/ingest] Successfully ingested ${totalUpserted} progress row(s) for contest ${contestId}`);
    return NextResponse.json({
      ok: true,
      updated: totalUpserted,
      total: progressRows.length,
      unmappedSlugs,
      missingUserIds,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[scrape/ingest] Exception: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
