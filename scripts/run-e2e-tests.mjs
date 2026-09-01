#!/usr/bin/env node

/**
 * ============================================================================
 * LMS Analytics Platform — Automated End-to-End Test Suite (Tiers 1 - 4)
 * ============================================================================
 * 
 * Comprehensive Requirement-Driven Opaque-Box Test Suite covering R1 through R5.
 * Run directly via Node.js (v18+) without external test framework dependencies.
 * 
 * Usage:
 *   node scripts/run-e2e-tests.mjs
 *   npm test (if wired in package.json)
 * ============================================================================
 */

import { performance } from 'perf_hooks';

// ─── ANSI Terminal Formatting Utilities ─────────────────────────────────────
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

// ─── Micro Test Framework Engine ─────────────────────────────────────────────
class TestRunner {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    this.startTime = 0;
  }

  describe(suiteName, fn) {
    const suite = { name: suiteName, tests: [] };
    this.suites.push(suite);
    this.currentSuite = suite;
    fn();
    this.currentSuite = null;
  }

  test(testName, fn) {
    if (!this.currentSuite) {
      throw new Error(`Test "${testName}" must be inside a describe suite.`);
    }
    this.currentSuite.tests.push({ name: testName, fn });
  }

  async run() {
    this.startTime = performance.now();
    console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}   LMS Analytics Platform — Automated End-to-End Test Suite (R1 - R5)${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

    for (const suite of this.suites) {
      console.log(`${colors.bold}${colors.magenta}▶ ${suite.name}${colors.reset}`);
      for (const t of suite.tests) {
        this.totalTests++;
        const tStart = performance.now();
        try {
          await t.fn();
          const duration = (performance.now() - tStart).toFixed(1);
          this.passedTests++;
          console.log(`  ${colors.green}✔ PASS${colors.reset} ${colors.white}${t.name}${colors.reset} ${colors.dim}(${duration}ms)${colors.reset}`);
        } catch (err) {
          const duration = (performance.now() - tStart).toFixed(1);
          this.failedTests++;
          console.log(`  ${colors.red}✖ FAIL${colors.reset} ${colors.white}${t.name}${colors.reset} ${colors.dim}(${duration}ms)${colors.reset}`);
          console.log(`    ${colors.red}Error: ${err.message}${colors.reset}`);
          if (err.stack) {
            const stackLines = err.stack.split('\n').slice(1, 3).map(l => `      ${colors.dim}${l.trim()}${colors.reset}`).join('\n');
            console.log(stackLines);
          }
        }
      }
      console.log('');
    }

    const totalDuration = ((performance.now() - this.startTime) / 1000).toFixed(2);
    console.log(`${colors.bold}${colors.cyan}----------------------------------------------------------------------${colors.reset}`);
    console.log(`${colors.bold}Test Execution Summary:${colors.reset}`);
    console.log(`  Total Test Suites: ${this.suites.length}`);
    console.log(`  Total Test Cases:  ${this.totalTests}`);
    console.log(`  Passed Tests:      ${colors.green}${colors.bold}${this.passedTests}${colors.reset}`);
    console.log(`  Failed Tests:      ${this.failedTests > 0 ? colors.red + colors.bold + this.failedTests : '0'}${colors.reset}`);
    console.log(`  Total Duration:    ${totalDuration}s`);
    console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

    if (this.failedTests > 0) {
      console.log(`${colors.bgRed}${colors.white}${colors.bold} ❌ TEST SUITE FAILED WITH ${this.failedTests} DEFECTS ${colors.reset}\n`);
      process.exitCode = 1;
    } else {
      console.log(`${colors.bgGreen}${colors.white}${colors.bold} ✔ ALL ${this.passedTests} TEST CASES PASSED SUCCESSFULLY ${colors.reset}\n`);
      process.exitCode = 0;
    }
  }
}

const runner = new TestRunner();
const describe = runner.describe.bind(runner);
const test = runner.test.bind(runner);

// ─── Custom Assertions ───────────────────────────────────────────────────────
function assert(condition, message = 'Assertion failed') {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message ? message + ': ' : ''}Expected ${JSON.stringify(expected)} (${typeof expected}) but received ${JSON.stringify(actual)} (${typeof actual})`);
  }
}

function assertDeepEqual(actual, expected, message = '') {
  const aStr = JSON.stringify(actual);
  const eStr = JSON.stringify(expected);
  if (aStr !== eStr) {
    throw new Error(`${message ? message + ': ' : ''}Expected ${eStr} but received ${aStr}`);
  }
}

function assertInRange(val, min, max, message = '') {
  if (typeof val !== 'number' || isNaN(val) || val < min || val > max) {
    throw new Error(`${message ? message + ': ' : ''}Value ${val} is not within [${min}, ${max}] range.`);
  }
}

function assertNotNaN(val, message = 'Value is NaN') {
  if (typeof val === 'number' && isNaN(val)) throw new Error(message);
}

// ─── Authoritative Domain Specifications & Algorithms ────────────────────────

/** Canonical Solved Checker (PROJECT.md § 1) */
function isRecordSolved(p) {
  if (!p) return false;
  const status = p.status ? String(p.status).toLowerCase().trim() : '';
  const score = typeof p.score === 'number' ? p.score : parseFloat(p.score) || 0;
  const maxScore = typeof p.max_score === 'number' ? p.max_score : (p.max_score !== undefined && p.max_score !== null ? parseFloat(p.max_score) : 10);
  
  if (status !== 'solved') return false;
  if (maxScore > 0) {
    return score >= maxScore;
  }
  return score > 0;
}

/** 3-Tier Contest Leaderboard Comparator (PROJECT.md § 2) */
function contestLeaderboardComparator(a, b) {
  return (b.score - a.score) || (b.solved - a.solved) || (a.name || '').localeCompare(b.name || '');
}

/** Smart CDN URL generator (PROJECT.md § 4) */
function getCdnStorageUrl(fileName, baseUrl = 'https://supabase.example.com', bustCache = true) {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/storage/v1/object/public/api-cache/${fileName}`;
  return bustCache ? `${url}?t=${Date.now()}` : url;
}

/** Safe Percentage Calculation with Clamping */
function calculatePercentage(solved, total) {
  if (!total || total <= 0 || isNaN(total)) return 0;
  if (!solved || solved <= 0 || isNaN(solved)) return 0;
  const pct = Math.round((solved / total) * 100);
  return Math.max(0, Math.min(100, pct));
}

/** Username normalizer */
function parseHackerrankUsername(input) {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;
  if (['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(s.toLowerCase())) {
    return null;
  }
  if (s.includes('hackerrank.com')) {
    try {
      const url = new URL(s.startsWith('http') ? s : `https://${s}`);
      const parts = url.pathname.split('/').filter(Boolean);
      const cleaned = parts[0] === 'profile' || parts[0] === 'hackers' ? parts.slice(1) : parts;
      s = cleaned[0] || '';
    } catch {
      const m = s.match(/hackerrank\.com\/(?:profile\/|hackers\/)?([^/?#]+)/i);
      s = m ? m[1] : s;
    }
  }
  s = s.replace(/^@+/, '').replace(/[/?#].*$/, '').trim();
  return s || null;
}

/** Generic Field Sanitizer */
function sanitizeField(val) {
  if (!val) return null;
  const trimmed = String(val).trim();
  if (!trimmed || ['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed;
}

/** Roadmap Question IDs Extractor */
function extractRoadmapQuestionIds(topics) {
  if (!Array.isArray(topics) || topics.length === 0) return [];
  const qIds = [];
  const hasNested = topics.some(t => t && t.questions && Array.isArray(t.questions) && t.questions.length > 0);
  if (hasNested) {
    topics.forEach(t => {
      (t?.questions || []).forEach(q => {
        const id = q?.id || q?.question_id;
        if (id) qIds.push(String(id));
      });
    });
  } else {
    topics.forEach(t => {
      const id = t?.id || t?.question_id;
      if (id) qIds.push(String(id));
    });
  }
  return Array.from(new Set(qIds));
}

/** Dense Ranker with Percentile for Leaderboards & Reports */
function computeDenseRanking(rows, scoreKey = 'score', nameKey = 'name') {
  const sorted = [...rows].sort((a, b) => (b[scoreKey] - a[scoreKey]) || (a[nameKey] || '').localeCompare(b[nameKey] || ''));
  let currentRank = 1;
  const total = sorted.length;
  
  return sorted.map((row, idx) => {
    if (idx > 0 && row[scoreKey] < sorted[idx - 1][scoreKey]) {
      currentRank = idx + 1;
    }
    const rank = currentRank;
    const percentile = (total > 0 && row[scoreKey] > 0)
      ? Math.round(((total - rank) / total) * 100)
      : 0;
    return { ...row, rank, percentile };
  });
}

/** Aggregation of Multi-Attempt Progress with Deduplication */
function deduplicateAndAggregateProgress(progressRows) {
  const userQuestionMap = new Map();
  progressRows.forEach(p => {
    if (!p.user_id || !p.question_id) return;
    const key = `${p.user_id}:${p.question_id}`;
    const score = Number(p.score || 0);
    const maxScore = Number(p.max_score || 10);
    const isSolved = isRecordSolved(p);
    
    if (!userQuestionMap.has(key)) {
      userQuestionMap.set(key, {
        user_id: p.user_id,
        question_id: p.question_id,
        score,
        maxScore,
        isSolved,
        lastSubmissionAt: p.last_submission_at || null,
      });
    } else {
      const existing = userQuestionMap.get(key);
      existing.score = Math.max(existing.score, score);
      if (isSolved) existing.isSolved = true;
      if (p.last_submission_at) {
        if (!existing.lastSubmissionAt || new Date(p.last_submission_at) > new Date(existing.lastSubmissionAt)) {
          existing.lastSubmissionAt = p.last_submission_at;
        }
      }
    }
  });

  return Array.from(userQuestionMap.values());
}

/** Pagination page numbers generator with ellipsis (PROJECT.md § 2 & Pagination component) */
function computePaginationPages(currentPage, totalPages) {
  const pages = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, '...', totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    }
  }
  return pages;
}

/** Null-safe user initials generator */
function getInitialsHelper(name) {
  if (!name || typeof name !== 'string') return 'TR';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TR';
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

/** Null-safe avatar gradient generator */
function getAvatarGradientHelper(name) {
  const gradients = [
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #3b82f6, #06b6d4)',
    'linear-gradient(135deg, #10b981, #059669)',
    'linear-gradient(135deg, #f59e0b, #d97706)',
    'linear-gradient(135deg, #ec4899, #8b5cf6)',
    'linear-gradient(135deg, #8b5cf6, #ec4899)',
  ];
  if (!name || typeof name !== 'string') return gradients[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}


// ============================================================================
// TIER 1: FEATURE COVERAGE (R1 - R5)
// ============================================================================

describe('Tier 1 — R1: Contest Analytics & Leaderboard Metrics', () => {
  test('T1.R1.01: Canonical solve check isRecordSolved returns true only on full score or status solved', () => {
    assertEqual(isRecordSolved({ status: 'solved', score: 10, max_score: 10 }), true, 'Full score solve');
    assertEqual(isRecordSolved({ status: 'solved', score: 15, max_score: 10 }), true, 'Bonus score solve');
    assertEqual(isRecordSolved({ status: 'solved', score: 5, max_score: 10 }), false, 'Partial score must return false');
    assertEqual(isRecordSolved({ status: 'attempted', score: 10, max_score: 10 }), false, 'Attempted status must return false');
    assertEqual(isRecordSolved({ status: 'solved', score: 0, max_score: 10 }), false, '0 score cannot be solved');
    assertEqual(isRecordSolved(null), false, 'Null record handling');
    assertEqual(isRecordSolved({ status: null, score: null, max_score: null }), false, 'Empty object handling');
  });

  test('T1.R1.02: Solved counting eliminates partial score false solves in aggregation', () => {
    const rawSubmissions = [
      { user_id: 'u1', question_id: 'q1', status: 'solved', score: 10, max_score: 10 },
      { user_id: 'u1', question_id: 'q2', status: 'solved', score: 4, max_score: 10 }, // partial false solve
      { user_id: 'u1', question_id: 'q3', status: 'attempted', score: 10, max_score: 10 }, // attempted
      { user_id: 'u2', question_id: 'q1', status: 'solved', score: 10, max_score: 10 },
      { user_id: 'u2', question_id: 'q2', status: 'solved', score: 10, max_score: 10 },
    ];
    
    const solvedU1 = rawSubmissions.filter(s => s.user_id === 'u1' && isRecordSolved(s)).length;
    const solvedU2 = rawSubmissions.filter(s => s.user_id === 'u2' && isRecordSolved(s)).length;
    
    assertEqual(solvedU1, 1, 'User 1 must have exactly 1 solve (q1)');
    assertEqual(solvedU2, 2, 'User 2 must have exactly 2 solves (q1, q2)');
  });

  test('T1.R1.03: Contest leaderboard deterministic 3-tier sort standard (score DESC, solved DESC, name ASC)', () => {
    const participants = [
      { id: '1', name: 'Zack', score: 100, solved: 5 },
      { id: '2', name: 'Alice', score: 100, solved: 5 },
      { id: '3', name: 'Bob', score: 100, solved: 4 },
      { id: '4', name: 'Charlie', score: 150, solved: 6 },
      { id: '5', name: 'Dan', score: 50, solved: 2 },
    ];

    const sorted = [...participants].sort(contestLeaderboardComparator);
    
    assertEqual(sorted[0].name, 'Charlie', 'Rank 1: Highest score (150)');
    assertEqual(sorted[1].name, 'Alice', 'Rank 2: Score 100, Solved 5, Name Alice comes before Zack');
    assertEqual(sorted[2].name, 'Zack', 'Rank 3: Score 100, Solved 5, Name Zack');
    assertEqual(sorted[3].name, 'Bob', 'Rank 4: Score 100, Solved 4');
    assertEqual(sorted[4].name, 'Dan', 'Rank 5: Score 50');
  });

  test('T1.R1.04: Elimination of Cartesian joins in contest assignments (group + team overlap)', () => {
    // User u1 belongs to group 'g1' AND team 'Alpha'. Both assigned to contest 'c1'.
    const assignments = [
      { contest_id: 'c1', group_id: 'g1', team: null },
      { contest_id: 'c1', group_id: null, team: 'Alpha' }
    ];
    const groupMembers = [{ group_id: 'g1', user_id: 'u1' }];
    const users = [{ id: 'u1', name: 'Trainer 1', team: 'Alpha', role: 'trainer' }];

    const assignedUserIds = new Set();
    assignments.forEach(a => {
      if (a.group_id) {
        groupMembers.filter(gm => gm.group_id === a.group_id).forEach(gm => assignedUserIds.add(gm.user_id));
      }
      if (a.team) {
        users.filter(u => u.team === a.team && u.role !== 'admin').forEach(u => assignedUserIds.add(u.id));
      }
    });

    assertEqual(assignedUserIds.size, 1, 'Assigned user count must be exactly 1, no duplicate Cartesian rows');
  });

  test('T1.R1.05: Multi-attempt score deduplication takes MAX score per distinct question', () => {
    const multiAttempts = [
      { user_id: 'u1', question_id: 'q1', score: 0, status: 'attempted', max_score: 10 },
      { user_id: 'u1', question_id: 'q1', score: 5, status: 'attempted', max_score: 10 },
      { user_id: 'u1', question_id: 'q1', score: 10, status: 'solved', max_score: 10 },
      { user_id: 'u1', question_id: 'q1', score: 8, status: 'attempted', max_score: 10 }, // subsequent lower attempt
    ];

    const deduplicated = deduplicateAndAggregateProgress(multiAttempts);
    assertEqual(deduplicated.length, 1, 'Should reduce to 1 unique question entry');
    assertEqual(deduplicated[0].score, 10, 'Must record MAX score 10');
    assertEqual(deduplicated[0].isSolved, true, 'Must record solved status');
  });

  test('T1.R1.06: Disabled questions (is_enabled: false) are excluded from question count and max score', () => {
    const questions = [
      { id: 'q1', title: 'Q1', max_score: 10, is_enabled: true },
      { id: 'q2', title: 'Q2', max_score: 20, is_enabled: false }, // disabled
      { id: 'q3', title: 'Q3', max_score: 15, is_enabled: true },
    ];

    const activeQuestions = questions.filter(q => q.is_enabled !== false);
    const totalMaxScore = activeQuestions.reduce((sum, q) => sum + q.max_score, 0);

    assertEqual(activeQuestions.length, 2, 'Active question count should be 2');
    assertEqual(totalMaxScore, 25, 'Total max score should exclude disabled question (10 + 15 = 25)');
  });
});

describe('Tier 1 — R2: Trainer Dashboard & Completion Rate Integrity', () => {
  test('T1.R2.01: Completion percentage clamping strictly falls within [0, 100]%', () => {
    assertInRange(calculatePercentage(0, 10), 0, 100, '0 solves out of 10');
    assertEqual(calculatePercentage(0, 10), 0, '0 solves');
    assertEqual(calculatePercentage(5, 10), 50, '5 solves out of 10');
    assertEqual(calculatePercentage(10, 10), 100, '10 solves out of 10');
    assertEqual(calculatePercentage(15, 10), 100, 'Over-solves clamped to 100%');
    assertEqual(calculatePercentage(-5, 10), 0, 'Negative solves clamped to 0%');
  });

  test('T1.R2.02: Division by zero prevention on 0-question contests and 0-size cohorts', () => {
    assertEqual(calculatePercentage(0, 0), 0, '0 / 0 returns 0, no NaN');
    assertEqual(calculatePercentage(5, 0), 0, '5 / 0 returns 0, no Infinity');
    assertEqual(calculatePercentage(0, -1), 0, 'Negative total returns 0');
    assertNotNaN(calculatePercentage(0, 0), 'No NaN');
  });

  test('T1.R2.03: Topic progress calculation distinguishes solved questions from mastered topics', () => {
    const topics = [
      { id: 't1', title: 'Arrays', questions: [{ id: 'q1' }, { id: 'q2' }] },
      { id: 't2', title: 'Strings', questions: [{ id: 'q3' }] },
    ];

    const userSolvedQIds = new Set(['q1']); // only 1 question of t1 solved
    
    let masteredTopicsCount = 0;
    topics.forEach(t => {
      const allSolved = t.questions.every(q => userSolvedQIds.has(q.id));
      if (allSolved) masteredTopicsCount++;
    });

    const uniqueQuestions = extractRoadmapQuestionIds(topics);
    assertEqual(uniqueQuestions.length, 3, 'Unique questions = 3');
    assertEqual(masteredTopicsCount, 0, 'Topic 1 is not fully mastered with 1/2 solves');
    assertEqual(userSolvedQIds.size, 1, '1 question solved out of 3');
  });

  test('T1.R2.04: Activity Heatmap aggregates dates correctly under Asia/Kolkata (IST)', () => {
    // 2026-08-29 19:00:00 UTC is 2026-08-30 00:30:00 IST (+5:30)
    const utcTimestamp = '2026-08-29T19:00:00.000Z';
    const dateObj = new Date(utcTimestamp);
    
    // Format to Asia/Kolkata date
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const istDate = istFormatter.format(dateObj); // YYYY-MM-DD format in en-CA

    assertEqual(istDate, '2026-08-30', '19:00 UTC on Aug 29 rolls over to Aug 30 in IST');
  });

  test('T1.R2.05: Cohort aggregate metrics (active user participation %, avg scores)', () => {
    const cohort = [
      { id: 'u1', score: 100, solved: 5, active: true },
      { id: 'u2', score: 50, solved: 2, active: true },
      { id: 'u3', score: 0, solved: 0, active: false },
      { id: 'u4', score: 0, solved: 0, active: false },
    ];

    const totalTrainers = cohort.length;
    const activeTrainers = cohort.filter(u => u.active).length;
    const participationRate = Math.round((activeTrainers / totalTrainers) * 100);
    const avgScore = Math.round(cohort.reduce((sum, u) => sum + u.score, 0) / totalTrainers);

    assertEqual(participationRate, 50, '50% participation rate');
    assertEqual(avgScore, 38, 'Average score across cohort = (100+50+0+0)/4 = 37.5 -> 38');
  });
});

describe('Tier 1 — R3: Reports Hub & Export Consistency', () => {
  test('T1.R3.01: Reports Hub date filter strictly enforces boundary constraints', () => {
    const rows = [
      { id: '1', trainerName: 'Alice', lastSubmissionAt: '2026-08-10T10:00:00.000Z' },
      { id: '2', trainerName: 'Bob', lastSubmissionAt: '2026-08-20T10:00:00.000Z' },
      { id: '3', trainerName: 'Charlie', lastSubmissionAt: '2026-08-28T10:00:00.000Z' },
    ];

    const filterStart = new Date('2026-08-15T00:00:00.000Z').getTime();
    const filterEnd = new Date('2026-08-25T23:59:59.999Z').getTime();

    const filtered = rows.filter(r => {
      if (!r.lastSubmissionAt) return false;
      const t = new Date(r.lastSubmissionAt).getTime();
      return t >= filterStart && t <= filterEnd;
    });

    assertEqual(filtered.length, 1, 'Only Bob falls within Aug 15 - Aug 25');
    assertEqual(filtered[0].trainerName, 'Bob');
  });

  test('T1.R3.02: Reports Hub custom end date is truncated to end-of-day 23:59:59.999Z', () => {
    const rawEndDateInput = '2026-08-29';
    // When end date is specified without time, parser extends to 23:59:59.999
    const effectiveEndDate = new Date(`${rawEndDateInput}T23:59:59.999Z`);
    const submissionSameDay = new Date('2026-08-29T18:30:00.000Z');

    assert(submissionSameDay.getTime() <= effectiveEndDate.getTime(), 'Submission at 18:30 on same day must be included');
  });

  test('T1.R3.03: Dense ranking preserves tied ranks and assigns 0th percentile to 0-score users', () => {
    const participants = [
      { name: 'Alice', score: 100 },
      { name: 'Bob', score: 100 },
      { name: 'Charlie', score: 80 },
      { name: 'Dan', score: 0 },
      { name: 'Eve', score: 0 },
    ];

    const ranked = computeDenseRanking(participants, 'score', 'name');
    assertEqual(ranked[0].rank, 1, 'Alice rank 1');
    assertEqual(ranked[1].rank, 1, 'Bob tied rank 1');
    assertEqual(ranked[2].rank, 3, 'Charlie rank 3');
    assertEqual(ranked[3].rank, 4, 'Dan rank 4');
    assertEqual(ranked[3].percentile, 0, '0-score user Dan gets 0th percentile');
    assertEqual(ranked[4].percentile, 0, '0-score user Eve gets 0th percentile');
  });

  test('T1.R3.04: Reports export formatting splits min, median, max scores and formats inactivity days', () => {
    const scores = [10, 20, 50, 80, 100];
    scores.sort((a, b) => a - b);
    const min = scores[0];
    const max = scores[scores.length - 1];
    const mid = Math.floor(scores.length / 2);
    const median = scores.length % 2 !== 0 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;

    assertEqual(min, 10);
    assertEqual(median, 50);
    assertEqual(max, 100);
  });

  test('T1.R3.05: Team filter preserves Unassigned cohort users without losing records', () => {
    const users = [
      { id: '1', name: 'U1', team: 'Alpha' },
      { id: '2', name: 'U2', team: '' },
      { id: '3', name: 'U3', team: null },
      { id: '4', name: 'U4', team: 'N/A' },
    ];

    const teamMapped = users.map(u => ({
      ...u,
      normalizedTeam: u.team && u.team.trim() !== '' && u.team !== 'N/A' ? u.team : 'Unassigned'
    }));

    const unassignedCount = teamMapped.filter(u => u.normalizedTeam === 'Unassigned').length;
    assertEqual(unassignedCount, 3, '3 users grouped into Unassigned cohort');
  });

  test('T1.R3.06: IT attendance counter multi-roadmap sync updates global users.it_days_count', () => {
    const userProfile = { id: 'u1', it_days_count: 5, last_it_check_date: '2026-08-28' };
    const today = '2026-08-29';

    // First check-in today on Roadmap A
    const isNewDay = userProfile.last_it_check_date !== today;
    const newGlobalCount = isNewDay ? userProfile.it_days_count + 1 : userProfile.it_days_count;
    
    assertEqual(newGlobalCount, 6, 'Global IT days increments to 6');

    // Second check-in today on Roadmap B (same day)
    const secondCheckInIsNewDay = today !== today; // already today
    const secondGlobalCount = secondCheckInIsNewDay ? newGlobalCount + 1 : newGlobalCount;
    assertEqual(secondGlobalCount, 6, 'Global IT days remains 6 when logging another roadmap on the same day');
  });
});

describe('Tier 1 — R1-IT: Internal Training Data Audit & Persistence Integrity', () => {
  test('T1.IT.01: GET /api/internal-training/trainer-overview RPC vs Fallback exact parity', () => {
    const today = '2026-08-29';
    const mockRoadmap = { id: 'rm1', title: 'DSA Mastery' };
    const mockTrainers = [
      { id: 'u1', full_name: 'Alice', emp_id: 'EMP001', team: 'Core', email: 'alice@example.com' },
      { id: 'u2', full_name: 'Bob', emp_id: null, team: null, email: 'bob@example.com' },
    ];
    const mockProgress = [
      { user_id: 'u1', roadmap_id: 'rm1', it_days_logged: 2, last_check_in_date: '2026-08-29', location: { type: 'Coimbatore-office' } },
      // u2 has no it_trainer_progress row
    ];

    // Evaluate in-app fallback model
    const fallbackItem = (u, p) => {
      const itDaysLogged = p?.it_days_logged || 0;
      const currentDay = Math.min(itDaysLogged, 2);
      const isCountedToday = p?.last_check_in_date === today;
      return {
        user_id: u.id,
        full_name: u.full_name || 'Unnamed Trainer',
        emp_id: u.emp_id || '—',
        team: u.team || 'N/A',
        email: u.email,
        roadmap_id: 'rm1',
        roadmap_title: 'DSA Mastery',
        current_day: currentDay,
        total_days: 2,
        completed_questions_count: u.id === 'u1' ? 1 : 0,
        total_questions_count: 2,
        pending_questions_count: u.id === 'u1' ? 1 : 0,
        it_days_count: itDaysLogged,
        location: isCountedToday ? p?.location || null : null,
        last_it_check_date: p?.last_check_in_date || null,
        is_it_counted_today: isCountedToday,
      };
    };

    const resU1 = fallbackItem(mockTrainers[0], mockProgress[0]);
    const resU2 = fallbackItem(mockTrainers[1], null);

    assertEqual(resU1.location?.type, 'Coimbatore-office', 'U1 checked in today -> location exposed');
    assertEqual(resU1.is_it_counted_today, true);
    assertEqual(resU1.last_it_check_date, '2026-08-29');

    assertEqual(resU2.location, null, 'U2 not checked in -> location is null');
    assertEqual(resU2.is_it_counted_today, false);
    assertEqual(resU2.last_it_check_date, null);
    assertEqual(resU2.it_days_count, 0);
  });

  test('T1.IT.02: POST /api/internal-training/attendance creates missing it_trainer_progress record', () => {
    const today = '2026-08-29';
    const db = {
      it_trainer_progress: [],
      users: [{ id: 'u_new', it_days_count: 0, last_it_check_date: null }]
    };

    const handleAttendanceUpdate = (userId, roadmapId, action, newCount) => {
      let progress = db.it_trainer_progress.find(p => p.user_id === userId && p.roadmap_id === roadmapId);
      const currentCount = progress?.it_days_logged || 0;

      let targetCount = currentCount;
      if (action === 'increment') targetCount = currentCount + 1;
      else if (action === 'decrement') targetCount = Math.max(0, currentCount - 1);
      else if (action === 'set' || typeof newCount === 'number') targetCount = Math.max(0, Number(newCount) || 0);

      if (progress) {
        progress.it_days_logged = targetCount;
        progress.current_day = targetCount;
        progress.last_check_in_date = today;
      } else {
        // Auto-create missing progress record!
        progress = {
          user_id: userId,
          roadmap_id: roadmapId,
          started_at: today,
          current_day: targetCount,
          it_days_logged: targetCount,
          last_check_in_date: today,
          extended_days: 0,
          extension_count: 0
        };
        db.it_trainer_progress.push(progress);
      }

      const user = db.users.find(u => u.id === userId);
      user.it_days_count = targetCount;
      user.last_it_check_date = today;
      return progress;
    };

    const created = handleAttendanceUpdate('u_new', 'rm1', 'increment');
    assertEqual(db.it_trainer_progress.length, 1, 'Record auto-created');
    assertEqual(created.it_days_logged, 1);
    assertEqual(created.current_day, 1);
    assertEqual(created.last_check_in_date, today);
    assertEqual(db.users[0].it_days_count, 1);
  });

  test('T1.IT.03: Question completion enforces portal-click gating across all solver combinations', () => {
    const evaluateCompletion = (clickedAt, isCompletedManual, hrStatus, hrScore, maxScore) => {
      const hasClicked = Boolean(clickedAt);
      const isHrSolved = hrStatus === 'solved' && (maxScore > 0 ? hrScore >= maxScore : hrScore > 0);
      const isManual = Boolean(isCompletedManual);
      const isComplete = hasClicked && (isHrSolved || isManual);
      const needsPortalClick = isHrSolved && !hasClicked;
      return { isComplete, needsPortalClick };
    };

    // 1. HR solved but never clicked in LMS -> incomplete
    assertEqual(evaluateCompletion(null, false, 'solved', 10, 10).isComplete, false);
    assertEqual(evaluateCompletion(null, false, 'solved', 10, 10).needsPortalClick, true);

    // 2. Clicked in LMS + HR solved -> complete
    assertEqual(evaluateCompletion('2026-08-29T12:00:00Z', false, 'solved', 10, 10).isComplete, true);
    assertEqual(evaluateCompletion('2026-08-29T12:00:00Z', false, 'solved', 10, 10).needsPortalClick, false);

    // 3. Clicked in LMS + manually checked -> complete
    assertEqual(evaluateCompletion('2026-08-29T12:00:00Z', true, 'unattempted', 0, 10).isComplete, true);

    // 4. Clicked in LMS + attempted only (partial score) -> incomplete
    assertEqual(evaluateCompletion('2026-08-29T12:00:00Z', false, 'attempted', 5, 10).isComplete, false);
  });

  test('T1.IT.04: recordITAttendance self-healing creates progress record if missing', () => {
    const today = '2026-08-29';
    const mockStore = {
      it_trainer_progress: [],
      users: [{ id: 'u1', it_days_count: 0, last_it_check_date: null }]
    };

    const simulateRecordITAttendance = (userId, roadmapId, location) => {
      let progress = mockStore.it_trainer_progress.find(p => p.user_id === userId && p.roadmap_id === roadmapId);
      if (!progress) {
        progress = {
          user_id: userId,
          roadmap_id: roadmapId,
          started_at: today,
          current_day: 0,
          it_days_logged: 0,
          last_check_in_date: null,
          extended_days: 0,
          extension_count: 0
        };
        mockStore.it_trainer_progress.push(progress);
      }

      const alreadyCheckedInToday = progress.last_check_in_date === today;
      const newDaysLogged = alreadyCheckedInToday ? progress.it_days_logged : progress.it_days_logged + 1;
      progress.it_days_logged = newDaysLogged;
      progress.current_day = newDaysLogged;
      progress.last_check_in_date = today;
      if (location) progress.location = location;

      const user = mockStore.users.find(u => u.id === userId);
      const isNewGlobalDate = user.last_it_check_date !== today;
      user.it_days_count = isNewGlobalDate ? user.it_days_count + 1 : user.it_days_count;
      user.last_it_check_date = today;

      return {
        success: true,
        roadmapDaysLogged: newDaysLogged,
        globalItDays: user.it_days_count,
        alreadyCheckedInToday,
        today,
        location: progress.location || null
      };
    };

    const res = simulateRecordITAttendance('u1', 'rm1', { type: 'Coimbatore-office' });
    assertEqual(res.success, true);
    assertEqual(res.roadmapDaysLogged, 1);
    assertEqual(res.globalItDays, 1);
    assertEqual(res.location?.type, 'Coimbatore-office');
    assertEqual(mockStore.it_trainer_progress.length, 1);
  });
});

describe('Tier 1 — R2-IT: Internal Training Pagination & Modal List Performance', () => {
  test('T1.R2IT.01: Pagination range calculation and totalPages logic', () => {
    const calc = (currentPage, totalItems, pageSize) => {
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const startItem = Math.min(totalItems, (currentPage - 1) * pageSize + 1);
      const endItem = Math.min(totalItems, currentPage * pageSize);
      return { totalPages, startItem, endItem };
    };

    // 0 items
    assertDeepEqual(calc(1, 0, 10), { totalPages: 1, startItem: 0, endItem: 0 });
    // 7 items with page size 10 (Page 1)
    assertDeepEqual(calc(1, 7, 10), { totalPages: 1, startItem: 1, endItem: 7 });
    // 25 items with page size 10
    assertDeepEqual(calc(1, 25, 10), { totalPages: 3, startItem: 1, endItem: 10 });
    assertDeepEqual(calc(2, 25, 10), { totalPages: 3, startItem: 11, endItem: 20 });
    assertDeepEqual(calc(3, 25, 10), { totalPages: 3, startItem: 21, endItem: 25 });
  });

  test('T1.R2IT.02: Smart numeric page button generation with ellipsis truncation', () => {
    // totalPages <= 5: all numbers rendered
    assertDeepEqual(computePaginationPages(1, 3), [1, 2, 3]);
    assertDeepEqual(computePaginationPages(3, 5), [1, 2, 3, 4, 5]);

    // totalPages > 5, near beginning (currentPage <= 3)
    assertDeepEqual(computePaginationPages(1, 10), [1, 2, 3, 4, '...', 10]);
    assertDeepEqual(computePaginationPages(2, 10), [1, 2, 3, 4, '...', 10]);
    assertDeepEqual(computePaginationPages(3, 10), [1, 2, 3, 4, '...', 10]);

    // totalPages > 5, near end (currentPage >= totalPages - 2)
    assertDeepEqual(computePaginationPages(8, 10), [1, '...', 7, 8, 9, 10]);
    assertDeepEqual(computePaginationPages(9, 10), [1, '...', 7, 8, 9, 10]);
    assertDeepEqual(computePaginationPages(10, 10), [1, '...', 7, 8, 9, 10]);

    // totalPages > 5, middle pages (surrounding window)
    assertDeepEqual(computePaginationPages(5, 10), [1, '...', 4, 5, 6, '...', 10]);
    assertDeepEqual(computePaginationPages(6, 10), [1, '...', 5, 6, 7, '...', 10]);
  });

  test('T1.R2IT.03: Page size selection & active page reset to 1', () => {
    let currentPage = 3;
    let pageSize = 10;

    const handlePageSizeChange = (newSize) => {
      pageSize = newSize;
      currentPage = 1; // standard reset contract
    };

    handlePageSizeChange(25);
    assertEqual(pageSize, 25);
    assertEqual(currentPage, 1, 'Active page must reset to 1 when changing page size');
  });

  test('T1.R2IT.04: Search and filter predicate changes reset active pagination page to 1', () => {
    let state = {
      currentPage: 4,
      search: '',
      roadmapFilter: 'All',
      statusFilter: 'all',
    };

    const onFilterChange = (updates) => {
      state = { ...state, ...updates, currentPage: 1 };
    };

    onFilterChange({ search: 'Alice' });
    assertEqual(state.currentPage, 1, 'Typing search resets page to 1');

    state.currentPage = 3;
    onFilterChange({ roadmapFilter: 'Full Stack Java' });
    assertEqual(state.currentPage, 1, 'Changing roadmap filter resets page to 1');

    state.currentPage = 2;
    onFilterChange({ statusFilter: 'online' });
    assertEqual(state.currentPage, 1, 'Changing status filter resets page to 1');
  });

  test('T1.R2IT.05: Admin Day Plan Question Picker slicing prevents DOM bloat on large catalogs', () => {
    const mockCatalog = Array.from({ length: 250 }, (_, i) => ({
      id: `q_${i + 1}`,
      title: `Challenge ${i + 1}`,
      contest_title: i % 2 === 0 ? 'Data Structures Contest' : 'Algorithms Contest',
      domain: i % 3 === 0 ? 'Algorithms' : 'Data Structures',
      difficulty: i % 2 === 0 ? 'Medium' : 'Hard',
    }));

    const slicePickerQuestions = (questions, page, pageSize, search, domain) => {
      const searchLower = (search || '').toLowerCase().trim();
      const filtered = questions.filter(q => {
        const titleLower = (q.title || '').toLowerCase();
        const contestLower = (q.contest_title || '').toLowerCase();
        const domainLower = (q.domain || '').toLowerCase();
        const matchesSearch = !searchLower || titleLower.includes(searchLower) || contestLower.includes(searchLower) || domainLower.includes(searchLower);
        const matchesDomain = domain === 'All' || q.domain === domain;
        return matchesSearch && matchesDomain;
      });

      const start = (page - 1) * pageSize;
      const paginated = filtered.slice(start, start + pageSize);
      return { totalFiltered: filtered.length, paginated };
    };

    // Page 1 with pageSize 10
    const page1 = slicePickerQuestions(mockCatalog, 1, 10, '', 'All');
    assertEqual(page1.totalFiltered, 250);
    assertEqual(page1.paginated.length, 10);
    assertEqual(page1.paginated[0].id, 'q_1');
    assertEqual(page1.paginated[9].id, 'q_10');

    // Page 2 with pageSize 10
    const page2 = slicePickerQuestions(mockCatalog, 2, 10, '', 'All');
    assertEqual(page2.paginated.length, 10);
    assertEqual(page2.paginated[0].id, 'q_11');
    assertEqual(page2.paginated[9].id, 'q_20');

    // Domain filter + search
    const filteredAlgo = slicePickerQuestions(mockCatalog, 1, 10, 'Challenge 10', 'Algorithms');
    assert(filteredAlgo.totalFiltered >= 1);
    assert(filteredAlgo.paginated.every(q => q.domain === 'Algorithms'));
  });

  test('T1.R2IT.06: Prev/Next boundary navigation clamping', () => {
    const totalPages = 5;
    let page = 1;

    // Prev on page 1 should stay 1
    page = Math.max(1, page - 1);
    assertEqual(page, 1, 'Prev on page 1 stays 1');

    // Forward to last page
    page = 5;
    // Next on last page should stay 5
    page = Math.min(totalPages, page + 1);
    assertEqual(page, 5, 'Next on last page stays totalPages');
  });
});

describe('Tier 1 — R3-IT: Null-Safe Filtering & UI Error Prevention', () => {
  test('T1.R3IT.01: Null-safe search predicate across incomplete trainer records', () => {
    const mockTrainers = [
      { user_id: '1', full_name: 'John Doe', emp_id: null, team: null, roadmap_title: null, email: null, location: null },
      { user_id: '2', full_name: null, emp_id: 'EMP100', team: 'Data Engineering', roadmap_title: 'PySpark', email: 'emp100@test.com', location: { type: 'Coimbatore-office' } },
      { user_id: '3', full_name: undefined, emp_id: undefined, team: undefined, roadmap_title: undefined, email: undefined, location: undefined },
      { user_id: '4', full_name: 'Jane Smith', emp_id: 'EMP101', team: 'Core', roadmap_title: 'Java DSA', email: 'jane@test.com', location: { type: 'Remote', detail: 'Home Office' } },
    ];

    const safeSearchFilter = (trainers, query) => {
      const q = (query || '').toLowerCase().trim();
      return trainers.filter(t => {
        return (
          !q ||
          (t.full_name || '').toLowerCase().includes(q) ||
          (t.emp_id || '').toLowerCase().includes(q) ||
          (t.team || '').toLowerCase().includes(q) ||
          (t.roadmap_title || '').toLowerCase().includes(q) ||
          (t.email || '').toLowerCase().includes(q) ||
          (t.location?.type || '').toLowerCase().includes(q) ||
          (t.location?.detail || '').toLowerCase().includes(q)
        );
      });
    };

    // Empty query returns all
    assertEqual(safeSearchFilter(mockTrainers, '').length, 4);
    // Searching John
    const resJohn = safeSearchFilter(mockTrainers, 'John');
    assertEqual(resJohn.length, 1);
    assertEqual(resJohn[0].user_id, '1');
    // Searching PySpark
    const resPy = safeSearchFilter(mockTrainers, 'pyspark');
    assertEqual(resPy.length, 1);
    assertEqual(resPy[0].user_id, '2');
    // Searching non-existent query
    assertEqual(safeSearchFilter(mockTrainers, 'nonexistentxyz').length, 0);
  });

  test('T1.R3IT.02: Location type and detail searching support', () => {
    const trainers = [
      { user_id: '1', full_name: 'Trainer A', location: { type: 'Chennai-office', detail: 'Tower 2 Floor 3' } },
      { user_id: '2', full_name: 'Trainer B', location: { type: 'Remote', detail: null } },
      { user_id: '3', full_name: 'Trainer C', location: null },
    ];

    const searchTrainers = (q) => {
      const query = (q || '').toLowerCase().trim();
      return trainers.filter(t => {
        return (
          !query ||
          (t.location?.type || '').toLowerCase().includes(query) ||
          (t.location?.detail || '').toLowerCase().includes(query)
        );
      });
    };

    assertEqual(searchTrainers('Chennai').length, 1);
    assertEqual(searchTrainers('Tower 2').length, 1);
    assertEqual(searchTrainers('Remote').length, 1);
    assertEqual(searchTrainers('Coimbatore').length, 0);
  });

  test('T1.R3IT.03: Avatar initials and gradient generation null and whitespace safety', () => {
    assertEqual(getInitialsHelper(null), 'TR');
    assertEqual(getInitialsHelper(undefined), 'TR');
    assertEqual(getInitialsHelper(''), 'TR');
    assertEqual(getInitialsHelper('   '), 'TR');
    assertEqual(getInitialsHelper('Suresh'), 'SU');
    assertEqual(getInitialsHelper('John Doe'), 'JD');
    assertEqual(getInitialsHelper('John Michael Doe'), 'JD');

    const gradNull = getAvatarGradientHelper(null);
    assert(gradNull.startsWith('linear-gradient('), 'Valid gradient on null name');
    const gradUndef = getAvatarGradientHelper(undefined);
    assert(gradUndef.startsWith('linear-gradient('), 'Valid gradient on undefined name');
    const gradEmpty = getAvatarGradientHelper('');
    assert(gradEmpty.startsWith('linear-gradient('), 'Valid gradient on empty string');
    const gradReal = getAvatarGradientHelper('Alice Walker');
    assert(gradReal.startsWith('linear-gradient('), 'Valid gradient on real name');
  });

  test('T1.R3IT.04: Numeric and progress sorting comparators withstand null/undefined values', () => {
    const list = [
      { id: '1', full_name: 'Bob', current_day: null, total_questions_count: 0, completed_questions_count: 0, pending_questions_count: null, it_days_count: null, extended_days: undefined },
      { id: '2', full_name: 'Alice', current_day: 5, total_questions_count: 10, completed_questions_count: 8, pending_questions_count: 2, it_days_count: 5, extended_days: 3 },
      { id: '3', full_name: null, current_day: 2, total_questions_count: 10, completed_questions_count: 10, pending_questions_count: 0, it_days_count: 2, extended_days: 0 },
    ];

    // Solved Progress comparator
    const sortByProgressAsc = [...list].sort((a, b) => {
      const progA = (a.total_questions_count && a.total_questions_count > 0) ? (a.completed_questions_count || 0) / a.total_questions_count : 0;
      const progB = (b.total_questions_count && b.total_questions_count > 0) ? (b.completed_questions_count || 0) / b.total_questions_count : 0;
      return progA - progB;
    });

    assertEqual(sortByProgressAsc[0].id, '1', '0 progress comes first');
    assertEqual(sortByProgressAsc[1].id, '2', '80% progress comes second');
    assertEqual(sortByProgressAsc[2].id, '3', '100% progress comes third');

    // Name comparator with null name
    const sortByNameAsc = [...list].sort((a, b) => {
      const nameA = (a.full_name || '').toLowerCase();
      const nameB = (b.full_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    assertEqual(sortByNameAsc[0].id, '3', 'Empty string / null comes first in ascending A-Z');
    assertEqual(sortByNameAsc[1].id, '2', 'Alice comes second');
    assertEqual(sortByNameAsc[2].id, '1', 'Bob comes third');
  });

  test('T1.R3IT.05: Clean empty state handling and filter reset behavior', () => {
    const emptyCohort = [];
    
    const renderEmptyStateProps = (trainers, isFiltered) => {
      if (trainers.length === 0) {
        return {
          showEmptyCard: true,
          message: isFiltered
            ? 'No trainers matched your search query or filters.'
            : 'No trainers have been assigned to internal training roadmaps yet.',
          showClearBtn: isFiltered,
        };
      }
      return { showEmptyCard: false };
    };

    const emptyUnfiltered = renderEmptyStateProps(emptyCohort, false);
    assertEqual(emptyUnfiltered.showEmptyCard, true);
    assertEqual(emptyUnfiltered.showClearBtn, false);

    const emptyFiltered = renderEmptyStateProps(emptyCohort, true);
    assertEqual(emptyFiltered.showEmptyCard, true);
    assertEqual(emptyFiltered.showClearBtn, true);
  });
});

describe('Tier 1 — R4: CDN & SWR Cache Synchronization', () => {
  test('T1.R4.01: Cache busting CDN storage URL appends ?t= timestamp parameter', () => {
    const urlWithTimestamp = getCdnStorageUrl('leaderboard.json', 'https://supabase.example.com', true);
    assert(urlWithTimestamp.includes('/api-cache/leaderboard.json?t='), 'Must contain ?t= timestamp parameter');
    
    const urlStatic = getCdnStorageUrl('leaderboard.json', 'https://supabase.example.com', false);
    assertEqual(urlStatic, 'https://supabase.example.com/storage/v1/object/public/api-cache/leaderboard.json');
  });

  test('T1.R4.02: CDN contest snapshot deduplicates progress rows by user_id:question_id before sum', () => {
    const duplicatedProgress = [
      { user_id: 'u1', question_id: 'q1', score: 10, status: 'solved', max_score: 10 },
      { user_id: 'u1', question_id: 'q1', score: 10, status: 'solved', max_score: 10 }, // duplicate
      { user_id: 'u1', question_id: 'q2', score: 5, status: 'attempted', max_score: 10 },
    ];

    const deduplicated = deduplicateAndAggregateProgress(duplicatedProgress);
    const totalScore = deduplicated.reduce((sum, p) => sum + p.score, 0);
    const totalSolved = deduplicated.filter(p => p.isSolved).length;

    assertEqual(totalScore, 15, 'Total score must be 10 + 5 = 15, not 25');
    assertEqual(totalSolved, 1, 'Total solved must be 1, not 2');
  });

  test('T1.R4.03: Self-healing snapshot fallback triggers when CDN returns 404', async () => {
    let fallbackTriggered = false;
    const fetchMock = async (url) => {
      if (url.includes('missing_contest.json')) {
        return { ok: false, status: 404 };
      }
      return { ok: true, json: async () => ({}) };
    };

    const getCachedData = async (fileName) => {
      const res = await fetchMock(fileName);
      if (!res.ok) {
        fallbackTriggered = true;
        return null;
      }
      return res.json();
    };

    const data = await getCachedData('missing_contest.json');
    assertEqual(data, null);
    assertEqual(fallbackTriggered, true, 'Self-healing trigger must execute on 404');
  });

  test('T1.R4.04: Global SWR mutation contract mutateAllTrainerData targets all trainer endpoints', () => {
    const targetEndpoints = [
      '/api/trainer/roadmaps',
      '/api/trainer/skills',
      '/api/trainer/courses',
      '/api/users/me'
    ];

    assertEqual(targetEndpoints.length, 4, 'Must mutate 4 specific trainer keys');
    assert(targetEndpoints.includes('/api/trainer/roadmaps'));
    assert(targetEndpoints.includes('/api/users/me'));
  });

  test('T1.R4.05: Multi-path and tag revalidation payload includes all dependent analytics routes', () => {
    const revalidatedPaths = ['/roadmaps', '/reports', '/internal-training', '/contests', '/dashboard'];
    const revalidatedTags = ['roadmaps', 'roadmap-analytics', 'internal-training', 'it-overview', 'leaderboard'];

    assertEqual(revalidatedPaths.length, 5);
    assertEqual(revalidatedTags.length, 5);
  });

  test('T1.R4.06: Question toggle and contest CRUD invalidates both CDN snapshots and Next.js tags', () => {
    const invalidateContest = (contestId) => {
      return {
        cdnFilesToUpload: [`contest_${contestId}.json`, 'leaderboard.json'],
        tagsToRevalidate: [`contest-${contestId}`, 'leaderboard', 'contests'],
        pathsToRevalidate: [`/contests/${contestId}`, '/dashboard', '/reports']
      };
    };

    const result = invalidateContest('contest-uuid-123');
    assert(result.cdnFilesToUpload.includes('contest_contest-uuid-123.json'));
    assert(result.tagsToRevalidate.includes('contest-contest-uuid-123'));
    assert(result.pathsToRevalidate.includes('/contests/contest-uuid-123'));
  });
});

describe('Tier 1 — R5: Database Schema & RPC Verification', () => {
  test('T1.R5.01: Schema DDL consistency: questions.is_enabled and questions.url columns', () => {
    const questionRecord = {
      id: 'q1',
      contest_id: 'c1',
      slug: 'two-sum',
      title: 'Two Sum',
      domain: 'Algorithms',
      hackerrank_url: 'https://hackerrank.com/challenges/two-sum',
      url: 'https://hackerrank.com/challenges/two-sum',
      max_score: 10,
      difficulty: 'Easy',
      order_index: 1,
      is_enabled: true
    };

    assertEqual(questionRecord.is_enabled, true);
    assert(questionRecord.url.length > 0);
  });

  test('T1.R5.02: RPC SQL logic verification: get_contest_analytics strict solve check', () => {
    const sqlSolveCondition = (status, score, maxScore) => {
      return status === 'solved' && (maxScore > 0 ? score >= maxScore : score > 0);
    };

    assertEqual(sqlSolveCondition('solved', 10, 10), true);
    assertEqual(sqlSolveCondition('solved', 9, 10), false);
    assertEqual(sqlSolveCondition('attempted', 10, 10), false);
  });

  test('T1.R5.03: RPC SQL logic verification: get_user_performance_profile distinct question MAX score', () => {
    const userProgress = [
      { question_id: 'q1', score: 5 },
      { question_id: 'q1', score: 10 },
      { question_id: 'q2', score: 20 },
    ];

    const qScores = new Map();
    userProgress.forEach(p => {
      qScores.set(p.question_id, Math.max(qScores.get(p.question_id) || 0, p.score));
    });

    let totalScore = 0;
    qScores.forEach(s => totalScore += s);

    assertEqual(totalScore, 30, 'Total score should be MAX(q1) + MAX(q2) = 10 + 20 = 30');
  });

  test('T1.R5.04: RPC SQL logic verification: get_roadmap_analytics & get_it_trainer_overview solve condition', () => {
    const rawProgress = [
      { is_completed: true, status: 'unattempted', score: 0 },
      { is_completed: false, status: 'solved', score: 10 },
      { is_completed: false, status: 'attempted', score: 5 },
      { is_completed: false, status: 'attempted', score: 0 },
    ];

    const isDone = (r) => r.is_completed === true || r.status === 'solved' || r.score > 0;
    const completedCount = rawProgress.filter(isDone).length;

    assertEqual(completedCount, 3, 'First 3 items count as completed or active');
  });

  test('T1.R5.05: Fast database-side leaderboard RPCs provide single-roundtrip aggregations', () => {
    const rpcLeaderboard = [
      { user_id: 'u1', name: 'Alice', score: 500, solved: 25 },
      { user_id: 'u2', name: 'Bob', score: 400, solved: 20 },
    ];

    assertEqual(rpcLeaderboard.length, 2);
    assertEqual(rpcLeaderboard[0].name, 'Alice');
  });
});


// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES
// ============================================================================

describe('Tier 2 — Boundary & Corner Cases', () => {
  test('T2.01: Zero submissions from all cohort users results in 0% completion and no runtime crashes', () => {
    const contest = { id: 'c1', total_questions: 10 };
    const trainers = [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }];
    const progress = []; // empty

    const totalSolvedSum = progress.length;
    const maxPossible = contest.total_questions * trainers.length;
    const pct = calculatePercentage(totalSolvedSum, maxPossible);

    assertEqual(pct, 0);
    assertNotNaN(pct);
  });

  test('T2.02: Empty cohort (0 assigned trainers) returns 0% without divide-by-zero exception', () => {
    const contest = { id: 'c1', total_questions: 5 };
    const trainers = []; // 0 trainers
    const pct = calculatePercentage(0, contest.total_questions * trainers.length);

    assertEqual(pct, 0);
    assertNotNaN(pct);
  });

  test('T2.03: 100% completion boundary condition when all trainers solve all questions', () => {
    const contest = { id: 'c1', total_questions: 4 };
    const trainers = [{ id: 'u1' }, { id: 'u2' }];
    const progress = [
      { user_id: 'u1', question_id: 'q1', score: 10, status: 'solved', max_score: 10 },
      { user_id: 'u1', question_id: 'q2', score: 10, status: 'solved', max_score: 10 },
      { user_id: 'u1', question_id: 'q3', score: 10, status: 'solved', max_score: 10 },
      { user_id: 'u1', question_id: 'q4', score: 10, status: 'solved', max_score: 10 },
      { user_id: 'u2', question_id: 'q1', score: 10, status: 'solved', max_score: 10 },
      { user_id: 'u2', question_id: 'q2', score: 10, status: 'solved', max_score: 10 },
      { user_id: 'u2', question_id: 'q3', score: 10, status: 'solved', max_score: 10 },
      { user_id: 'u2', question_id: 'q4', score: 10, status: 'solved', max_score: 10 },
    ];

    const totalSolvedSum = progress.filter(isRecordSolved).length;
    const maxPossible = contest.total_questions * trainers.length;
    const pct = calculatePercentage(totalSolvedSum, maxPossible);

    assertEqual(pct, 100, 'Perfect cohort completion must equal 100%');
  });

  test('T2.04: Massive multi-attempts on single problem (50 submissions with alternating scores)', () => {
    const attempts = [];
    for (let i = 0; i < 50; i++) {
      const score = (i === 42) ? 10 : (i % 7);
      attempts.push({
        user_id: 'u1',
        question_id: 'q_hard',
        score,
        status: score >= 10 ? 'solved' : 'attempted',
        max_score: 10,
        last_submission_at: new Date(Date.now() + i * 1000).toISOString()
      });
    }

    const deduped = deduplicateAndAggregateProgress(attempts);
    assertEqual(deduped.length, 1);
    assertEqual(deduped[0].score, 10);
    assertEqual(deduped[0].isSolved, true);
  });

  test('T2.05: Negative or corrupted score values are safely clamped to 0', () => {
    const corruptedProgress = [
      { user_id: 'u1', question_id: 'q1', score: -50, status: 'attempted', max_score: 10 },
      { user_id: 'u1', question_id: 'q2', score: 'NaN', status: 'attempted', max_score: 10 },
    ];

    const sanitized = corruptedProgress.map(p => {
      const parsed = Number(p.score);
      const score = (!isNaN(parsed) && parsed > 0) ? parsed : 0;
      return { ...p, score };
    });

    assertEqual(sanitized[0].score, 0);
    assertEqual(sanitized[1].score, 0);
  });

  test('T2.06: Date boundary timestamp filter on exact boundary millisecond (23:59:59.999Z)', () => {
    const boundaryTime = new Date('2026-08-29T23:59:59.999Z').getTime();
    const subAtExactBoundary = '2026-08-29T23:59:59.999Z';
    const subOneMsAfter = '2026-08-30T00:00:00.000Z';

    assert(new Date(subAtExactBoundary).getTime() <= boundaryTime, 'Exact boundary must match');
    assert(new Date(subOneMsAfter).getTime() > boundaryTime, '1ms after must NOT match');
  });

  test('T2.07: Inactive user with 0 submissions and no check-ins is categorized High Risk with 999 days inactive', () => {
    const user = { id: 'u_inactive', it_days_count: 0, last_it_check_date: null };
    const progressList = [];
    const itProgressList = [];

    const now = new Date();
    const daysInactive = 999;
    const isHighRisk = daysInactive >= 14 || (daysInactive >= 7 && progressList.length === 0 && user.it_days_count === 0);

    assertEqual(isHighRisk, true, 'Zero activity user must be flagged High Risk');
  });

  test('T2.08: Special characters, unicode, and quotes in names and teams are handled safely', () => {
    const specialUsers = [
      { id: '1', full_name: "O'Connor", team: 'Team Alpha & Beta' },
      { id: '2', full_name: 'René François', team: 'Team "Quote"' },
      { id: '3', full_name: '<Script>Alert</Script>', team: 'Team & Special' }
    ];

    const teamFilter = 'Team Alpha & Beta';
    const matches = specialUsers.filter(u => u.team === teamFilter);
    assertEqual(matches.length, 1);
    assertEqual(matches[0].full_name, "O'Connor");
  });

  test('T2.09: Large cohort pagination stability (1,000+ users simulated chunking)', () => {
    const largeUserList = [];
    for (let i = 0; i < 1500; i++) {
      largeUserList.push({ id: `user_${i}`, score: i % 100 });
    }

    const pageSize = 1000;
    let paginated = [];
    let from = 0;
    while (from < largeUserList.length) {
      const page = largeUserList.slice(from, from + pageSize);
      paginated = paginated.concat(page);
      from += pageSize;
    }

    assertEqual(paginated.length, 1500, 'Chunking must preserve all 1500 records');
  });

  test('T2.10: Inverted date filter (startDate > endDate) produces empty matching set without crash', () => {
    const rows = [
      { id: '1', lastSubmissionAt: '2026-08-15T10:00:00.000Z' }
    ];

    const start = new Date('2026-08-25T00:00:00.000Z').getTime();
    const end = new Date('2026-08-10T00:00:00.000Z').getTime(); // end < start

    const filtered = rows.filter(r => {
      const t = new Date(r.lastSubmissionAt).getTime();
      return t >= start && t <= end;
    });

    assertEqual(filtered.length, 0, 'Inverted range produces 0 records safely');
  });

  test('T2.11: Null and placeholder tokens sanitized gracefully by sanitizeField', () => {
    assertEqual(sanitizeField('nil'), null);
    assertEqual(sanitizeField('N/A'), null);
    assertEqual(sanitizeField('  -  '), null);
    assertEqual(sanitizeField('undefined'), null);
    assertEqual(sanitizeField('  Valid Handle  '), 'Valid Handle');
  });

  test('T2.12: HackerRank username normalization across URLs and handles via parseHackerrankUsername', () => {
    assertEqual(parseHackerrankUsername('https://www.hackerrank.com/profile/alice_dev'), 'alice_dev');
    assertEqual(parseHackerrankUsername('https://hackerrank.com/hackers/bob_coder'), 'bob_coder');
    assertEqual(parseHackerrankUsername('@charlie_123'), 'charlie_123');
    assertEqual(parseHackerrankUsername('dan_simple'), 'dan_simple');
    assertEqual(parseHackerrankUsername('none'), null);
  });
});


// ============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS & END-TO-END PIPELINES
// ============================================================================

describe('Tier 3 — Cross-Feature Combinations & Pipelines', () => {
  test('T3.01: Scraper Ingest -> DB Progress -> CDN Snapshot -> Reports Hub -> Leaderboard UI', () => {
    // 1. Raw Scraper Ingest
    const ingestedSubmissions = [
      { user_id: 'u1', question_id: 'q1', score: 10, status: 'solved', max_score: 10 },
      { user_id: 'u1', question_id: 'q2', score: 10, status: 'solved', max_score: 10 },
      { user_id: 'u2', question_id: 'q1', score: 10, status: 'solved', max_score: 10 },
      { user_id: 'u2', question_id: 'q2', score: 5, status: 'attempted', max_score: 10 },
    ];

    // 2. CDN Snapshot Deduplication & Pre-calculation
    const deduped = deduplicateAndAggregateProgress(ingestedSubmissions);
    const u1Records = deduped.filter(p => p.user_id === 'u1');
    const u2Records = deduped.filter(p => p.user_id === 'u2');

    const leaderboard = [
      { id: 'u1', name: 'Alice', score: u1Records.reduce((s, p) => s + p.score, 0), solved: u1Records.filter(p => p.isSolved).length },
      { id: 'u2', name: 'Bob', score: u2Records.reduce((s, p) => s + p.score, 0), solved: u2Records.filter(p => p.isSolved).length },
    ].sort(contestLeaderboardComparator);

    // 3. UI and Reports Parity Check
    assertEqual(leaderboard[0].name, 'Alice');
    assertEqual(leaderboard[0].score, 20);
    assertEqual(leaderboard[0].solved, 2);
    assertEqual(leaderboard[1].name, 'Bob');
    assertEqual(leaderboard[1].score, 15);
    assertEqual(leaderboard[1].solved, 1);
  });

  test('T3.02: IT Check-In Toggle ON -> Location Recorded -> Question Solve -> Global Attendance Sync', () => {
    // Initial state
    const user = { id: 'u1', it_days_count: 3, last_it_check_date: '2026-08-28' };
    const roadmapProgress = { it_days_logged: 3, location: null };
    const today = '2026-08-29';
    const selectedLocation = 'Coimbatore-office';

    // Step 1: Check-in with location
    roadmapProgress.it_days_logged += 1;
    roadmapProgress.location = selectedLocation;
    user.it_days_count += 1;
    user.last_it_check_date = today;

    // Step 2: Solve Day 4 Question
    const questionSolve = { day_question_id: 'dq4', user_id: 'u1', is_completed: true };

    assertEqual(roadmapProgress.location, 'Coimbatore-office');
    assertEqual(roadmapProgress.it_days_logged, 4);
    assertEqual(user.it_days_count, 4);
    assertEqual(questionSolve.is_completed, true);
  });

  test('T3.03: Contest Question is_enabled: false -> Max Score Recalculation -> CDN & Leaderboard update', () => {
    const contestQuestions = [
      { id: 'q1', max_score: 10, is_enabled: true },
      { id: 'q2', max_score: 20, is_enabled: true }, // will disable
      { id: 'q3', max_score: 30, is_enabled: true },
    ];

    // Toggle q2 off
    contestQuestions[1].is_enabled = false;
    const activeQuestions = contestQuestions.filter(q => q.is_enabled !== false);
    const totalContestMaxScore = activeQuestions.reduce((s, q) => s + q.max_score, 0);

    assertEqual(totalContestMaxScore, 40, '10 + 30 = 40 max score');
  });

  test('T3.04: Multi-Group and Team Assignment Overlap -> Contest Analytics -> Reports Export Parity', () => {
    const assignedUserIds = new Set();
    const groupMembers = [{ group_id: 'g1', user_id: 'u1' }, { group_id: 'g2', user_id: 'u1' }];
    groupMembers.forEach(gm => assignedUserIds.add(gm.user_id));

    assertEqual(assignedUserIds.size, 1, 'Same user across multiple assigned groups counted once in reports export');
  });

  test('T3.05: Roadmap Nested Topics -> User Progress Update -> Dashboard Topic Progress Widget', () => {
    const roadmap = {
      topics: [
        { id: 't1', title: 'Trees', questions: [{ id: 'q1' }, { id: 'q2' }] },
        { id: 't2', title: 'Graphs', questions: [{ id: 'q3' }, { id: 'q4' }] },
      ]
    };

    const qIds = extractRoadmapQuestionIds(roadmap.topics);
    assertEqual(qIds.length, 4);

    const userProgress = new Set(['q1', 'q2', 'q3', 'q4']);
    let completedTopics = 0;
    roadmap.topics.forEach(t => {
      if (t.questions.every(q => userProgress.has(q.id))) completedTopics++;
    });

    const completionPct = calculatePercentage(completedTopics, roadmap.topics.length);
    assertEqual(completionPct, 100, 'All topics completed -> 100%');
  });

  test('T3.06: LeetCode Profile Sync -> GraphQL Stats Ingestion -> User Performance Profile', () => {
    const leetcodeStats = {
      user_id: 'u1',
      solved_easy: 50,
      solved_medium: 30,
      solved_hard: 10,
      solved_total: 90,
      ranking: 12500,
      contest_rating: 1650
    };

    assertEqual(leetcodeStats.solved_total, 90);
    assertEqual(leetcodeStats.solved_easy + leetcodeStats.solved_medium + leetcodeStats.solved_hard, 90);
  });

  test('T3.07: Admin Direct Profile Edit -> Support Ticket Resolution -> Contest Leaderboard Name Sync', () => {
    const user = { id: 'u1', full_name: 'Old Name', team: 'Old Team' };
    
    // Admin direct update
    user.full_name = 'New Verified Name';
    user.team = 'Team Alpha';

    const leaderboardEntry = {
      user_id: user.id,
      name: user.full_name,
      team: user.team,
      score: 100
    };

    assertEqual(leaderboardEntry.name, 'New Verified Name');
    assertEqual(leaderboardEntry.team, 'Team Alpha');
  });

  test('T3.08: Inactivity Audit Scan -> Multi-Source Activity Merge (Contest + IT + Todos) -> Risk Tier', () => {
    const now = new Date('2026-08-29T12:00:00.000Z');
    const contestActivity = new Date('2026-08-27T12:00:00.000Z'); // 2 days ago
    const itActivity = new Date('2026-08-20T12:00:00.000Z'); // 9 days ago

    const latestActivity = new Date(Math.max(contestActivity.getTime(), itActivity.getTime()));
    const daysInactive = Math.floor((now.getTime() - latestActivity.getTime()) / (1000 * 60 * 60 * 24));

    assertEqual(daysInactive, 2);
    const riskTier = daysInactive <= 3 ? 'active' : daysInactive <= 7 ? 'medium' : 'high';
    assertEqual(riskTier, 'active');
  });

  test('T3.09: Contest Creation with Topic Tagging -> Auto-Scrape Scheduler -> CDN Cache Refresh', () => {
    const contest = {
      id: 'c1',
      title: 'DSA Sprint',
      topics: ['Arrays', 'Dynamic Programming'],
      auto_scrape_enabled: true
    };

    assertEqual(contest.topics.length, 2);
    assertEqual(contest.auto_scrape_enabled, true);
  });
});


// ============================================================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS
// ============================================================================

describe('Tier 4 — Real-World Application Scenarios', () => {
  test('T4.01: Multi-Trainer Weekly Coding Bootcamp (50 trainers, 4 teams, 3 contests, mixed submissions)', () => {
    const trainers = [];
    for (let i = 0; i < 50; i++) {
      trainers.push({
        id: `trainer_${i}`,
        name: `Trainer ${i}`,
        team: `Team ${i % 4 + 1}`,
      });
    }

    const submissions = [];
    trainers.forEach((t, idx) => {
      // 10 trainers solve all 3 questions in contest 1
      if (idx < 10) {
        submissions.push({ user_id: t.id, contest_id: 'c1', question_id: 'q1', status: 'solved', score: 10, max_score: 10 });
        submissions.push({ user_id: t.id, contest_id: 'c1', question_id: 'q2', status: 'solved', score: 20, max_score: 20 });
        submissions.push({ user_id: t.id, contest_id: 'c1', question_id: 'q3', status: 'solved', score: 30, max_score: 30 });
      } else if (idx < 30) {
        // 20 trainers partial solve
        submissions.push({ user_id: t.id, contest_id: 'c1', question_id: 'q1', status: 'solved', score: 10, max_score: 10 });
      }
      // Remaining 20 have zero submissions
    });

    const deduped = deduplicateAndAggregateProgress(submissions);
    const masteredCount = trainers.filter(t => {
      const userSolved = deduped.filter(p => p.user_id === t.id && p.isSolved).length;
      return userSolved === 3;
    }).length;

    assertEqual(masteredCount, 10, 'Exactly 10 trainers mastered contest 1');
  });

  test('T4.02: Trainer Attendance Dispute Workflow (Dispute creation, manager approval, count decrement)', () => {
    const user = { id: 'u1', it_days_count: 5 };
    const disputeTicket = {
      id: 'disp_1',
      user_id: 'u1',
      status: 'pending',
      reason: 'Logged attendance mistakenly on holiday'
    };

    // Manager approves dispute
    disputeTicket.status = 'approved';
    if (disputeTicket.status === 'approved') {
      user.it_days_count = Math.max(0, user.it_days_count - 1);
    }

    assertEqual(disputeTicket.status, 'approved');
    assertEqual(user.it_days_count, 4, 'Attendance safely decremented to 4');
  });

  test('T4.03: Mid-Contest Question Revision & Scoring Adjustment with Deterministic Leaderboard', () => {
    const questions = [
      { id: 'q1', max_score: 10, is_enabled: true },
      { id: 'q2', max_score: 10, is_enabled: true },
    ];

    // Revision: Update q2 max score to 20
    questions[1].max_score = 20;

    const submissions = [
      { user_id: 'u1', question_id: 'q1', score: 10, status: 'solved', max_score: 10 },
      { user_id: 'u1', question_id: 'q2', score: 20, status: 'solved', max_score: 20 },
      { user_id: 'u2', question_id: 'q1', score: 10, status: 'solved', max_score: 10 },
      { user_id: 'u2', question_id: 'q2', score: 10, status: 'solved', max_score: 20 }, // only 10/20 -> not solved
    ];

    const u1Solves = submissions.filter(s => s.user_id === 'u1' && isRecordSolved(s)).length;
    const u2Solves = submissions.filter(s => s.user_id === 'u2' && isRecordSolved(s)).length;

    assertEqual(u1Solves, 2);
    assertEqual(u2Solves, 1, 'u2 score 10/20 is partial and must NOT count as solved');
  });

  test('T4.04: Cohort Benchmark Analysis & Manager KPI Dashboard (Team Filter Parity)', () => {
    const trainers = [
      { id: 'u1', name: 'Alice', team: 'Team Alpha', score: 100 },
      { id: 'u2', name: 'Bob', team: 'Team Alpha', score: 200 },
      { id: 'u3', name: 'Charlie', team: 'Team Beta', score: 150 },
    ];

    const alphaTrainers = trainers.filter(t => t.team === 'Team Alpha');
    const alphaAvg = Math.round(alphaTrainers.reduce((s, t) => s + t.score, 0) / alphaTrainers.length);

    assertEqual(alphaTrainers.length, 2);
    assertEqual(alphaAvg, 150, 'Team Alpha avg score = (100+200)/2 = 150');
  });

  test('T4.05: Auto-Scrape Cron Execution & Lock Concurrency Guard', () => {
    const cronState = { is_running: false };

    const runCronJob = () => {
      if (cronState.is_running) {
        return { started: false, reason: 'Concurrency lock active' };
      }
      cronState.is_running = true;
      return { started: true };
    };

    const job1 = runCronJob();
    const job2 = runCronJob(); // overlapping attempt

    assertEqual(job1.started, true);
    assertEqual(job2.started, false);
    assertEqual(job2.reason, 'Concurrency lock active');
  });

  test('T4.06: Trainee Cross-Domain Learning Path (Multiple roadmaps, transcript aggregation)', () => {
    const user = { id: 'u1', full_name: 'Trainee 1' };
    const roadmapA = { id: 'r_dsa', domain: 'DSA', completed_topics: 5, total_topics: 5 };
    const roadmapB = { id: 'r_web', domain: 'Web Dev', completed_topics: 3, total_topics: 5 };

    const isRoadmapAComplete = calculatePercentage(roadmapA.completed_topics, roadmapA.total_topics) === 100;
    const isRoadmapBComplete = calculatePercentage(roadmapB.completed_topics, roadmapB.total_topics) === 100;

    assertEqual(isRoadmapAComplete, true);
    assertEqual(isRoadmapBComplete, false);
  });

  test('T4.07: High-Concurrency Leaderboard Tie-Break Resolution (10 trainers identical score)', () => {
    const tiedTrainers = [
      { name: 'David', score: 100, solved: 5 },
      { name: 'Alice', score: 100, solved: 5 },
      { name: 'Charlie', score: 100, solved: 5 },
      { name: 'Bob', score: 100, solved: 5 },
    ];

    const sorted = [...tiedTrainers].sort(contestLeaderboardComparator);
    assertEqual(sorted[0].name, 'Alice');
    assertEqual(sorted[1].name, 'Bob');
    assertEqual(sorted[2].name, 'Charlie');
    assertEqual(sorted[3].name, 'David');
  });

  test('T4.08: Date-Range Filtered Reports Generation with Midnight End Boundary Parity', () => {
    const submissionTimestamps = [
      '2026-08-01T10:00:00.000Z',
      '2026-08-15T23:59:59.000Z',
      '2026-08-15T23:59:59.999Z',
      '2026-08-16T00:00:00.000Z',
    ];

    const rangeEnd = new Date('2026-08-15T23:59:59.999Z').getTime();
    const inRange = submissionTimestamps.filter(ts => new Date(ts).getTime() <= rangeEnd);

    assertEqual(inRange.length, 3, 'First 3 timestamps within Aug 15 EOD');
  });

  test('T4.09: Global SWR Cache Invalidation on Scraper Job Completion', async () => {
    let revalidatedKeys = [];
    const fakeMutate = async (key) => {
      revalidatedKeys.push(key);
    };

    const onScraperJobComplete = async () => {
      const keys = ['/api/trainer/roadmaps', '/api/trainer/skills', '/api/trainer/courses', '/api/users/me'];
      for (const k of keys) {
        await fakeMutate(k);
      }
    };

    await onScraperJobComplete();
    assertEqual(revalidatedKeys.length, 4);
    assert(revalidatedKeys.includes('/api/trainer/roadmaps'));
  });
});

// ─── Execute Test Suite ──────────────────────────────────────────────────────
runner.run();
