import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  fetchProblemDetails,
  fetchProblemListQuestions,
  parseProblemListId,
  parseProblemSlug,
  sleep,
} from '@/lib/leetcode';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const rawInputs: string[] = Array.isArray(body.inputs)
      ? body.inputs
      : typeof body.input === 'string'
      ? body.input.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean)
      : [];

    if (rawInputs.length === 0) {
      return NextResponse.json({ error: 'No problem links or slugs provided' }, { status: 400 });
    }

    // Limit inputs to reasonable batch size
    const inputs = rawInputs.slice(0, 100);
    const questions: any[] = [];
    const seenSlugs = new Set<string>();

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];

      // 1. Check if input is a LeetCode problem list
      const listId = parseProblemListId(input);
      if (listId) {
        const listQuestions = await fetchProblemListQuestions(listId);
        for (const item of listQuestions) {
          if (!item.slug || seenSlugs.has(item.slug)) continue;
          seenSlugs.add(item.slug);
          questions.push({
            slug: item.slug,
            title: item.title,
            domain: item.domain || 'Algorithms',
            difficulty: item.difficulty || 'Medium',
            max_score: item.difficulty === 'Easy' ? 5 : item.difficulty === 'Hard' ? 15 : 10,
            url: item.url || `https://leetcode.com/problems/${item.slug}/`,
            order_index: questions.length,
          });
        }
        continue;
      }

      // 2. Individual problem slug or URL
      const slug = parseProblemSlug(input);
      if (!slug || seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);

      const details = await fetchProblemDetails(slug);
      questions.push({
        slug: details.slug,
        title: details.title,
        domain: details.domain || 'Algorithms',
        difficulty: details.difficulty || 'Medium',
        max_score: details.difficulty === 'Easy' ? 5 : details.difficulty === 'Hard' ? 15 : 10,
        url: details.url || `https://leetcode.com/problems/${details.slug}/`,
        order_index: questions.length,
      });

      // Polite delay between individual LeetCode GraphQL calls
      if (i < inputs.length - 1) {
        await sleep(350);
      }
    }

    return NextResponse.json({
      success: true,
      questions,
      count: questions.length,
    });
  } catch (err: any) {
    console.error('[problem-lookup] Error looking up LeetCode problems:', err);
    return NextResponse.json({ error: 'Failed to lookup problems' }, { status: 500 });
  }
}
