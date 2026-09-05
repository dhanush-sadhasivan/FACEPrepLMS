/**
 * LeetCode client library for LMS.
 * Interacts with LeetCode's public GraphQL API (https://leetcode.com/graphql).
 */

const GRAPHQL_URL = 'https://leetcode.com/graphql';
const REQUEST_DELAY_MS = 1200;
const MAX_RETRIES = 2;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SAFE_LEETCODE_IDENTIFIER = /^[a-zA-Z0-9_-]+$/;

/**
 * Accepts a raw username or any LeetCode profile URL and returns the normalized username.
 * Validates against safe alphanumeric/hyphen regex (/^[a-zA-Z0-9_-]+$/).
 * e.g., "https://leetcode.com/u/jdoe/" -> "jdoe", "jdoe" -> "jdoe"
 */
export function parseLeetcodeUsername(input?: string | null): string | null {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;
  if (['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(s.toLowerCase())) {
    return null;
  }
  if (s.includes('leetcode.com')) {
    try {
      const url = new URL(s.startsWith('http') ? s : `https://${s}`);
      const parts = url.pathname.split('/').filter(Boolean);
      const cleaned = parts[0] === 'u' ? parts.slice(1) : parts;
      s = cleaned[0] || '';
    } catch {
      const m = s.match(/leetcode\.com\/(?:u\/)?([^/?#]+)/i);
      s = m ? m[1] : s;
    }
  }
  s = s.replace(/^@+/, '').replace(/[/?#].*$/, '').trim();
  if (!s || !SAFE_LEETCODE_IDENTIFIER.test(s)) {
    return null;
  }
  return s;
}

/**
 * Convert a LeetCode problem URL or slug into a canonical titleSlug.
 * Validates against safe alphanumeric/hyphen regex (/^[a-zA-Z0-9_-]+$/).
 * e.g., "https://leetcode.com/problems/two-sum/" -> "two-sum", "two-sum" -> "two-sum"
 */
export function parseProblemSlug(input?: string | null): string | null {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;
  if (['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(s.toLowerCase())) {
    return null;
  }
  const m = s.match(/problems\/([^/?#]+)/i);
  if (m) {
    const candidate = m[1].toLowerCase().replace(/[/?#].*$/, '').trim();
    return SAFE_LEETCODE_IDENTIFIER.test(candidate) ? candidate : null;
  }
  const candidate = s.replace(/[/?#].*$/, '').toLowerCase().trim();
  return SAFE_LEETCODE_IDENTIFIER.test(candidate) ? candidate : null;
}

/**
 * Check if the input is a LeetCode problem list URL or slug.
 * Validates against safe alphanumeric/hyphen regex (/^[a-zA-Z0-9_-]+$/).
 * e.g., "https://leetcode.com/problem-list/top-interview-questions/" -> "top-interview-questions"
 * e.g., "https://leetcode.com/problem-list/7957516d/" -> "7957516d"
 * e.g., "https://leetcode.com/list/top-interview-questions" -> "top-interview-questions"
 */
export function parseProblemListId(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  if (['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(s.toLowerCase())) {
    return null;
  }
  const m = s.match(/(?:problem-list|list)\/([^/?#]+)/i);
  if (m) {
    const candidate = m[1].toLowerCase().replace(/[/?#].*$/, '').trim();
    return SAFE_LEETCODE_IDENTIFIER.test(candidate) ? candidate : null;
  }
  const candidate = s.replace(/[/?#].*$/, '').toLowerCase().trim();
  return SAFE_LEETCODE_IDENTIFIER.test(candidate) ? candidate : null;
}

async function gql<T = any>(query: string, variables: Record<string, any>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: 'https://leetcode.com',
      Origin: 'https://leetcode.com',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 429) {
    const err = new Error('LeetCode rate-limited the request (HTTP 429)');
    (err as any).rateLimited = true;
    throw err;
  }
  if (!res.ok) throw new Error(`LeetCode HTTP ${res.status}`);

  const json = await res.json();
  if (json.errors?.length) {
    const isUserNotFound = json.errors.some((e: any) =>
      e.message?.toLowerCase().includes('that user does not exist') ||
      e.message?.toLowerCase().includes('user does not exist')
    );
    if (json.data !== undefined && (isUserNotFound || json.data?.matchedUser !== undefined)) {
      return json.data;
    }
    if (!json.data) {
      throw new Error(json.errors.map((e: any) => e.message).join('; '));
    }
  }
  return json.data;
}

async function gqlWithRetry<T = any>(
  query: string,
  variables: Record<string, any>,
  retries = MAX_RETRIES
): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await gql<T>(query, variables);
    } catch (err: any) {
      lastErr = err;
      if (err.rateLimited) {
        await sleep(REQUEST_DELAY_MS * (attempt + 2));
      } else {
        await sleep(REQUEST_DELAY_MS);
      }
    }
  }
  throw lastErr;
}

// ── GraphQL Queries ──────────────────────────────────────────────────────────

const PROFILE_QUERY = `
  query userProfile($username: String!) {
    matchedUser(username: $username) {
      username
      profile { ranking realName userAvatar }
      submitStatsGlobal { acSubmissionNum { difficulty count } }
    }
    userContestRanking(username: $username) { rating globalRanking }
  }`;

const CALENDAR_QUERY = `
  query userCalendar($username: String!) {
    matchedUser(username: $username) {
      userCalendar { submissionCalendar }
    }
  }`;

const RECENT_AC_QUERY = `
  query recentAc($username: String!, $limit: Int!) {
    recentAcSubmissionList(username: $username, limit: $limit) {
      title titleSlug timestamp
    }
  }`;

const PROBLEM_QUERY = `
  query questionTitle($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionId
      title
      titleSlug
      difficulty
      topicTags { name slug }
    }
  }`;

const PROBLEM_LIST_QUERY = `
  query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
    problemsetQuestionList: questionList(
      categorySlug: $categorySlug
      limit: $limit
      skip: $skip
      filters: $filters
    ) {
      total: totalNum
      questions: data {
        title
        titleSlug
        difficulty
        topicTags { name slug }
      }
    }
  }`;

// ── Public APIs ──────────────────────────────────────────────────────────────

export interface LeetCodeProfileResult {
  username: string;
  found: boolean;
  ranking: number | null;
  realName: string;
  avatar: string;
  contestRating: number | null;
  solved: {
    easy: number;
    medium: number;
    hard: number;
    total: number;
  };
  submissionCalendar: Record<string, number>;
}

export async function fetchProfileStats(username: string): Promise<LeetCodeProfileResult> {
  const cleanUser = parseLeetcodeUsername(username);
  if (!cleanUser) {
    return {
      username: username || '',
      found: false,
      ranking: null,
      realName: '',
      avatar: '',
      contestRating: null,
      solved: { easy: 0, medium: 0, hard: 0, total: 0 },
      submissionCalendar: {},
    };
  }

  try {
    const data = await gqlWithRetry(PROFILE_QUERY, { username: cleanUser });
    const user = data?.matchedUser;
    if (!user) {
      return {
        username: cleanUser,
        found: false,
        ranking: null,
        realName: '',
        avatar: '',
        contestRating: null,
        solved: { easy: 0, medium: 0, hard: 0, total: 0 },
        submissionCalendar: {},
      };
    }

    const counts = { easy: 0, medium: 0, hard: 0, total: 0 };
    for (const row of user.submitStatsGlobal?.acSubmissionNum || []) {
      const d = (row.difficulty || '').toLowerCase();
      if (d === 'all') counts.total = row.count || 0;
      else if (counts[d as keyof typeof counts] !== undefined) {
        (counts as any)[d] = row.count || 0;
      }
    }
    if (!counts.total) {
      counts.total = counts.easy + counts.medium + counts.hard;
    }

    let submissionCalendar: Record<string, number> = {};
    try {
      const calData = await gqlWithRetry(CALENDAR_QUERY, { username: cleanUser });
      const raw = calData?.matchedUser?.userCalendar?.submissionCalendar;
      if (raw) submissionCalendar = JSON.parse(raw);
    } catch {
      // calendar is best-effort
    }

    return {
      username: user.username,
      found: true,
      ranking: user.profile?.ranking ?? null,
      realName: user.profile?.realName || '',
      avatar: user.profile?.userAvatar || '',
      contestRating: data?.userContestRanking?.rating
        ? Math.round(data.userContestRanking.rating)
        : null,
      solved: counts,
      submissionCalendar,
    };
  } catch (err: any) {
    console.warn(`[leetcode] fetchProfileStats error for ${cleanUser}:`, err.message);
    return {
      username: cleanUser,
      found: false,
      ranking: null,
      realName: '',
      avatar: '',
      contestRating: null,
      solved: { easy: 0, medium: 0, hard: 0, total: 0 },
      submissionCalendar: {},
    };
  }
}

export interface RecentAcSubmission {
  title: string;
  titleSlug: string;
  timestamp: string | number;
}

export async function fetchRecentAc(
  username: string,
  limit = 20
): Promise<RecentAcSubmission[]> {
  const cleanUser = parseLeetcodeUsername(username);
  if (!cleanUser) return [];
  const data = await gqlWithRetry(RECENT_AC_QUERY, { username: cleanUser, limit });
  return data?.recentAcSubmissionList || [];
}

export interface ProblemLookupResult {
  slug: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Unknown';
  domain: string;
  url: string;
  found: boolean;
}

export async function fetchProblemDetails(input: string): Promise<ProblemLookupResult> {
  const slug = parseProblemSlug(input);
  if (!slug) {
    return {
      slug: input,
      title: input,
      difficulty: 'Unknown',
      domain: 'General',
      url: input,
      found: false,
    };
  }

  try {
    const data = await gqlWithRetry(PROBLEM_QUERY, { titleSlug: slug });
    const q = data?.question;
    if (!q) {
      return {
        slug,
        title: slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        difficulty: 'Medium',
        domain: 'General',
        url: `https://leetcode.com/problems/${slug}/`,
        found: false,
      };
    }

    const domain = q.topicTags?.[0]?.name || 'Algorithms';
    return {
      slug: q.titleSlug || slug,
      title: q.title || slug,
      difficulty: (q.difficulty as any) || 'Medium',
      domain,
      url: `https://leetcode.com/problems/${slug}/`,
      found: true,
    };
  } catch (err) {
    return {
      slug,
      title: slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      difficulty: 'Medium',
      domain: 'General',
      url: `https://leetcode.com/problems/${slug}/`,
      found: false,
    };
  }
}

export async function fetchProblemListQuestions(input: string): Promise<ProblemLookupResult[]> {
  const listId = parseProblemListId(input) || (SAFE_LEETCODE_IDENTIFIER.test(input.trim()) ? input.trim() : null);
  if (!listId) return [];

  try {
    const data = await gqlWithRetry(PROBLEM_LIST_QUERY, {
      categorySlug: '',
      skip: 0,
      limit: 100,
      filters: { listId },
    });

    const list = data?.problemsetQuestionList?.questions || [];
    return list.map((q: any) => ({
      slug: q.titleSlug,
      title: q.title,
      difficulty: (q.difficulty as any) || 'Medium',
      domain: q.topicTags?.[0]?.name || 'Algorithms',
      url: `https://leetcode.com/problems/${q.titleSlug}/`,
      found: true,
    }));
  } catch (err) {
    console.error(`[leetcode] Failed to fetch problem list "${listId}":`, err);
    return [];
  }
}
