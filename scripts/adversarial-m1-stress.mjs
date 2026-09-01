#!/usr/bin/env node

/**
 * ============================================================================
 * Adversarial Stress Test Harness — Milestone 1 (M1-1)
 * ============================================================================
 * 
 * Empirical verification of isRecordSolved(), SQL RPC logic models,
 * multi-attempt deduplication, boundary conditions, floating point edge cases,
 * and Cartesian join resistance.
 * ============================================================================
 */

import { performance } from 'perf_hooks';
import { isRecordSolved, parseHackerrankUsername, sanitizeField } from '../lib/utils.ts';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const failures = [];

function assert(condition, testName, details = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ${colors.green}✔ PASS${colors.reset} ${testName}`);
  } else {
    failedChecks++;
    failures.push({ testName, details });
    console.log(`  ${colors.red}✖ FAIL${colors.reset} ${testName} ${details ? `— ${details}` : ''}`);
  }
}

console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}   ADVERSARIAL STRESS TEST HARNESS — MILESTONE 1 (CHALLENGER M1-1)   ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: isRecordSolved() Adversarial Matrix
// ─────────────────────────────────────────────────────────────────────────────
console.log(`${colors.bold}${colors.magenta}▶ Suite 1: isRecordSolved() Adversarial Input Matrix${colors.reset}`);

// 1.1 Standard Solved vs Partial
assert(isRecordSolved({ status: 'solved', score: 10, max_score: 10 }) === true, 'Exact match 10/10 is solved');
assert(isRecordSolved({ status: 'solved', score: 100, max_score: 100 }) === true, 'Exact match 100/100 is solved');
assert(isRecordSolved({ status: 'solved', score: 5, max_score: 10 }) === false, 'Partial score 5/10 is NOT solved');
assert(isRecordSolved({ status: 'solved', score: 9.99, max_score: 10 }) === false, 'Partial score 9.99/10 is NOT solved');
assert(isRecordSolved({ status: 'solved', score: 0.5, max_score: 1 }) === false, 'Partial score 0.5/1 is NOT solved');
assert(isRecordSolved({ status: 'solved', score: 99, max_score: 100 }) === false, 'Partial score 99/100 is NOT solved');
assert(isRecordSolved({ status: 'solved', score: 0, max_score: 10 }) === false, 'Zero score 0/10 with solved status is NOT solved');
assert(isRecordSolved({ status: 'solved', score: 15, max_score: 10 }) === true, 'Bonus score 15/10 is solved');

// 1.2 Zero Max Score (max_score = 0)
assert(isRecordSolved({ status: 'solved', score: 10, max_score: 0 }) === true, 'Score 10 with max_score 0 is solved');
assert(isRecordSolved({ status: 'solved', score: 0.1, max_score: 0 }) === true, 'Score 0.1 with max_score 0 is solved');
assert(isRecordSolved({ status: 'solved', score: 0, max_score: 0 }) === false, 'Score 0 with max_score 0 is NOT solved');
assert(isRecordSolved({ status: 'solved', score: -1, max_score: 0 }) === false, 'Negative score with max_score 0 is NOT solved');

// 1.3 Null / Undefined / Negative / Non-finite Values
assert(isRecordSolved(null) === false, 'null record is NOT solved');
assert(isRecordSolved(undefined) === false, 'undefined record is NOT solved');
assert(isRecordSolved({}) === false, 'empty object is NOT solved');
assert(isRecordSolved({ status: 'solved', score: null, max_score: 10 }) === false, 'null score with max_score 10 is NOT solved');
assert(isRecordSolved({ status: 'solved', score: undefined, max_score: 10 }) === false, 'undefined score with max_score 10 is NOT solved');
assert(isRecordSolved({ status: 'solved', score: null, max_score: null }) === false, 'null score and null max_score is NOT solved');
assert(isRecordSolved({ status: 'solved', score: 10, max_score: null }) === true, 'Score 10 with null max_score defaults maxScore 0 and is solved');
assert(isRecordSolved({ status: 'solved', score: -5, max_score: 10 }) === false, 'Negative score -5/10 is NOT solved');
assert(isRecordSolved({ status: 'solved', score: -5, max_score: -10 }) === false, 'Negative score with negative max_score is NOT solved');
assert(isRecordSolved({ status: 'solved', score: NaN, max_score: 10 }) === false, 'NaN score is NOT solved');
assert(isRecordSolved({ status: 'solved', score: 10, max_score: NaN }) === true, 'Score 10 with NaN max_score falls back to score > 0 (solved)');
assert(isRecordSolved({ status: 'solved', score: Infinity, max_score: 10 }) === false, 'Infinity score is rejected by isFinite check');

// 1.4 String Number Inputs & Coercion
assert(isRecordSolved({ status: 'solved', score: '10', max_score: '10' }) === true, 'String score "10" / "10" is solved');
assert(isRecordSolved({ status: 'solved', score: '5', max_score: '10' }) === false, 'String score "5" / "10" is NOT solved');
assert(isRecordSolved({ status: 'solved', score: 'invalid', max_score: '10' }) === false, 'String score "invalid" is NOT solved');

// 1.5 Non-solved Statuses
assert(isRecordSolved({ status: 'attempted', score: 10, max_score: 10 }) === false, 'Status "attempted" with full score is NOT solved');
assert(isRecordSolved({ status: 'failed', score: 10, max_score: 10 }) === false, 'Status "failed" with full score is NOT solved');
assert(isRecordSolved({ status: 'SOLVED', score: 10, max_score: 10 }) === false, 'Status uppercase "SOLVED" is NOT solved (strict enum)');
assert(isRecordSolved({ status: '', score: 10, max_score: 10 }) === false, 'Empty status is NOT solved');

// 1.6 Floating Point Precision
assert(isRecordSolved({ status: 'solved', score: 0.1 + 0.2, max_score: 0.3 }) === true, 'Floating point score (0.1+0.2 >= 0.3) is solved');
assert(isRecordSolved({ status: 'solved', score: 1 / 3, max_score: 1 / 3 }) === true, 'Floating point fraction (1/3 >= 1/3) is solved');

console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Multi-Attempt Deduplication Stress Test
// ─────────────────────────────────────────────────────────────────────────────
console.log(`${colors.bold}${colors.magenta}▶ Suite 2: Multi-Attempt Deduplication Stress Test${colors.reset}`);

// Simulate a user with 10 submissions on question Q1 with erratic scores and statuses
const attempts = [
  { question_id: 'q1', status: 'attempted', score: 0, max_score: 10 },
  { question_id: 'q1', status: 'attempted', score: 2, max_score: 10 },
  { question_id: 'q1', status: 'attempted', score: 5, max_score: 10 },
  { question_id: 'q1', status: 'solved', score: 10, max_score: 10 },
  { question_id: 'q1', status: 'attempted', score: 3, max_score: 10 }, // subsequent lower attempt
  { question_id: 'q1', status: 'solved', score: 10, max_score: 10 },    // duplicate solve
  { question_id: 'q2', status: 'attempted', score: 4, max_score: 10 },
  { question_id: 'q2', status: 'attempted', score: 7, max_score: 10 },
  { question_id: 'q3', status: 'solved', score: 20, max_score: 20 },
];

// Deduplicate by question_id (model of SQL dedup_q and TS userQuestionMap)
const dedupMap = new Map();
attempts.forEach(att => {
  const isSolved = isRecordSolved(att);
  if (!dedupMap.has(att.question_id)) {
    dedupMap.set(att.question_id, {
      max_score: att.score || 0,
      is_solved: isSolved,
      is_attempted: att.status === 'solved' || att.status === 'attempted' || (att.score || 0) > 0,
    });
  } else {
    const existing = dedupMap.get(att.question_id);
    existing.max_score = Math.max(existing.max_score, att.score || 0);
    if (isSolved) existing.is_solved = true;
    if (att.status === 'solved' || att.status === 'attempted' || (att.score || 0) > 0) {
      existing.is_attempted = true;
    }
  }
});

let totalSolved = 0;
let totalScore = 0;
let problemsAttempted = 0;

dedupMap.forEach(val => {
  if (val.is_solved) totalSolved++;
  totalScore += val.max_score;
  if (val.is_attempted) problemsAttempted++;
});

assert(totalSolved === 2, 'Multi-attempt: Total solved is exactly 2 (q1 solved, q2 partial, q3 solved)');
assert(totalScore === 37, 'Multi-attempt: Total score is 10 (q1) + 7 (q2) + 20 (q3) = 37 (NOT sum of all 9 rows: 61)');
assert(problemsAttempted === 3, 'Multi-attempt: Problems attempted is exactly 3');

console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: SQL RPC Logic & Cartesian Join Stress Test
// ─────────────────────────────────────────────────────────────────────────────
console.log(`${colors.bold}${colors.magenta}▶ Suite 3: SQL RPC Logic & Cartesian Join Emulation${colors.reset}`);

// Simulate a database with complex relationships
const dbUsers = [
  { id: 'u1', full_name: 'Alice Trainer', role: 'trainer', team: 'Batch-A' },
  { id: 'u2', full_name: 'Bob Trainer', role: 'trainer', team: 'Batch-A' },
  { id: 'u3', full_name: 'Charlie Trainer', role: 'trainer', team: 'Batch-B' },
  { id: 'u4', full_name: 'Admin Dave', role: 'admin', team: 'Batch-A' },
  { id: 'u5', full_name: 'Eve Trainer', role: 'trainer', team: 'Batch-C' }, // not assigned
];

const dbGroups = [
  { id: 'g1', name: 'Group Alpha' },
  { id: 'g2', name: 'Group Beta' },
];

const dbGroupMembers = [
  { group_id: 'g1', user_id: 'u1' },
  { group_id: 'g1', user_id: 'u2' },
  { group_id: 'g1', user_id: 'u4' }, // admin in group
  { group_id: 'g2', user_id: 'u1' }, // u1 in two groups!
  { group_id: 'g2', user_id: 'u3' },
];

const dbContests = [
  { id: 'c1', title: 'Contest 1', hackerrank_slug: 'contest-1', start_date: '2026-08-01T00:00:00Z' },
  { id: 'c2', title: 'Empty Contest', hackerrank_slug: 'contest-2', start_date: '2026-08-02T00:00:00Z' },
  { id: 'c3', title: 'Zero Question Contest', hackerrank_slug: 'contest-3', start_date: '2026-08-03T00:00:00Z' },
];

const dbAssignments = [
  // Contest 1 assigned via BOTH group_id g1, group_id g2, AND team 'Batch-A' (massive potential Cartesian overlap)
  { contest_id: 'c1', group_id: 'g1', team: null },
  { contest_id: 'c1', group_id: 'g2', team: null },
  { contest_id: 'c1', group_id: null, team: 'Batch-A' },
  // Contest 2 has NO assignments
  // Contest 3 assigned to Batch-B
  { contest_id: 'c3', group_id: null, team: 'Batch-B' },
];

const dbQuestions = [
  { id: 'q101', contest_id: 'c1', max_score: 10, is_enabled: true },
  { id: 'q102', contest_id: 'c1', max_score: 20, is_enabled: true },
  { id: 'q103', contest_id: 'c1', max_score: 30, is_enabled: false }, // disabled question!
  // c2 has questions but no assigned users
  { id: 'q201', contest_id: 'c2', max_score: 10, is_enabled: true },
  // c3 has 0 questions
];

const dbProgress = [
  // u1 submissions for c1
  { id: 1, contest_id: 'c1', user_id: 'u1', question_id: 'q101', score: 10, max_score: 10, status: 'solved' },
  { id: 2, contest_id: 'c1', user_id: 'u1', question_id: 'q101', score: 10, max_score: 10, status: 'solved' }, // duplicate progress row!
  { id: 3, contest_id: 'c1', user_id: 'u1', question_id: 'q102', score: 20, max_score: 20, status: 'solved' },
  { id: 4, contest_id: 'c1', user_id: 'u1', question_id: 'q103', score: 30, max_score: 30, status: 'solved' }, // on disabled question
  // u2 submissions for c1
  { id: 5, contest_id: 'c1', user_id: 'u2', question_id: 'q101', score: 5, max_score: 10, status: 'solved' }, // partial score!
  { id: 6, contest_id: 'c1', user_id: 'u2', question_id: 'q102', score: 20, max_score: 20, status: 'solved' },
  // u3 submissions for c1 (u3 is in g2, so assigned to c1)
  { id: 7, contest_id: 'c1', user_id: 'u3', question_id: 'q101', score: 0, max_score: 10, status: 'attempted' },
  // u4 (admin) submissions for c1
  { id: 8, contest_id: 'c1', user_id: 'u4', question_id: 'q101', score: 10, max_score: 10, status: 'solved' },
  { id: 9, contest_id: 'c1', user_id: 'u4', question_id: 'q102', score: 20, max_score: 20, status: 'solved' },
];

// --- Execute SQL RPC Model for get_contest_analytics ---
function executeGetContestAnalyticsRPC() {
  // 1. contest_qs CTE
  const contest_qs = new Map();
  dbQuestions.forEach(q => {
    if (q.is_enabled !== false) {
      contest_qs.set(q.contest_id, (contest_qs.get(q.contest_id) || 0) + 1);
    }
  });

  // 2. assigned_users CTE (UNION eliminates duplicates across group and team)
  const assigned_users_set = new Set();
  const assigned_users = [];

  // Branch 1: ca.group_id
  dbAssignments.forEach(ca => {
    if (ca.group_id) {
      dbGroupMembers.forEach(gm => {
        if (gm.group_id === ca.group_id) {
          const user = dbUsers.find(u => u.id === gm.user_id);
          if (user && user.role !== 'admin') {
            const key = `${ca.contest_id}:${user.id}`;
            if (!assigned_users_set.has(key)) {
              assigned_users_set.add(key);
              assigned_users.push({ c_id: ca.contest_id, user_id: user.id });
            }
          }
        }
      });
    }
  });

  // Branch 2: ca.team (UNION)
  dbAssignments.forEach(ca => {
    if (ca.team && ca.team.trim() !== '') {
      dbUsers.forEach(u => {
        if (u.team === ca.team && u.role !== 'admin') {
          const key = `${ca.contest_id}:${u.id}`;
          if (!assigned_users_set.has(key)) {
            assigned_users_set.add(key);
            assigned_users.push({ c_id: ca.contest_id, user_id: u.id });
          }
        }
      });
    }
  });

  // 3. user_contest_solved CTE
  const user_contest_solved = [];
  assigned_users.forEach(au => {
    const q_count = contest_qs.get(au.c_id) || 0;
    
    // Enabled questions for this contest
    const enabled_qs = dbQuestions.filter(q => q.contest_id === au.c_id && q.is_enabled !== false);
    const enabled_q_ids = new Set(enabled_qs.map(q => q.id));

    // Progress matching solve condition
    const solved_question_ids = new Set();
    dbProgress.forEach(p => {
      if (p.contest_id === au.c_id && p.user_id === au.user_id && enabled_q_ids.has(p.question_id)) {
        const q = enabled_qs.find(item => item.id === p.question_id);
        const maxScore = (p.max_score != null ? p.max_score : (q?.max_score || 0));
        const isSolved = p.status === 'solved' && (maxScore > 0 ? p.score >= maxScore : p.score > 0);
        if (isSolved) {
          solved_question_ids.add(p.question_id);
        }
      }
    });

    user_contest_solved.push({
      c_id: au.c_id,
      user_id: au.user_id,
      q_count,
      solved_count: solved_question_ids.size,
    });
  });

  // 4. Final aggregation
  return dbContests.map(c => {
    const q_count = contest_qs.get(c.id) || 0;
    const contest_assigned = assigned_users.filter(au => au.c_id === c.id);
    const assigned_trainers_count = new Set(contest_assigned.map(au => au.user_id)).size;

    const contest_ucs = user_contest_solved.filter(ucs => ucs.c_id === c.id);
    const completed_trainers_count = contest_ucs.filter(ucs => ucs.q_count > 0 && ucs.solved_count >= ucs.q_count).length;
    const total_solved_sum = contest_ucs.reduce((acc, ucs) => acc + ucs.solved_count, 0);

    let completion_percentage = 0;
    if (assigned_trainers_count > 0 && q_count > 0) {
      const max_possible = q_count * assigned_trainers_count;
      completion_percentage = Math.min(100.0, Math.round(((total_solved_sum / max_possible) * 100) * 10) / 10);
    }

    return {
      contest_id: c.id,
      title: c.title,
      question_count: q_count,
      assigned_trainers_count,
      completed_trainers_count,
      total_solved_sum,
      completion_percentage,
    };
  });
}

const contestAnalyticsResults = executeGetContestAnalyticsRPC();
const c1Stats = contestAnalyticsResults.find(r => r.contest_id === 'c1');
const c2Stats = contestAnalyticsResults.find(r => r.contest_id === 'c2');
const c3Stats = contestAnalyticsResults.find(r => r.contest_id === 'c3');

// Invariants check on C1:
// Enabled questions = 2 (q101, q102). q103 is disabled.
// Assigned non-admin trainers = 3 (u1 from g1+g2+Batch-A, u2 from g1+Batch-A, u3 from g2). u4 is admin (excluded). u5 is not assigned.
// Solved counts:
//   u1: q101 (solved 10/10), q102 (solved 20/20) -> 2 solves -> COMPLETED!
//   u2: q101 (partial 5/10 - NOT SOLVED), q102 (solved 20/20) -> 1 solve -> NOT COMPLETED!
//   u3: q101 (0/10 attempted) -> 0 solves -> NOT COMPLETED!
// Total solved sum = 2 + 1 + 0 = 3
// Max possible solves = 2 questions * 3 trainers = 6
// Completion % = (3 / 6) * 100 = 50.0%

assert(c1Stats.question_count === 2, 'Contest 1: Enabled question count is 2 (excludes disabled question q103)');
assert(c1Stats.assigned_trainers_count === 3, 'Contest 1: Assigned trainers count is 3 (u1, u2, u3 deduplicated across groups & team; admin excluded)');
assert(c1Stats.completed_trainers_count === 1, 'Contest 1: Completed trainers is 1 (only u1 solved all enabled questions)');
assert(c1Stats.total_solved_sum === 3, 'Contest 1: Total solved sum is 3 (u1: 2, u2: 1 [partial excluded], u3: 0)');
assert(c1Stats.completion_percentage === 50.0, 'Contest 1: Completion percentage is exactly 50.0%');

// Invariants check on C2 (Empty Contest):
assert(c2Stats.assigned_trainers_count === 0, 'Contest 2 (Empty cohort): assigned_trainers_count is 0');
assert(c2Stats.completed_trainers_count === 0, 'Contest 2: completed_trainers_count is 0');
assert(c2Stats.completion_percentage === 0, 'Contest 2: completion_percentage is 0 (no divide-by-zero crash)');

// Invariants check on C3 (Zero Question Contest):
assert(c3Stats.question_count === 0, 'Contest 3 (0 questions): question_count is 0');
assert(c3Stats.assigned_trainers_count === 1, 'Contest 3: assigned_trainers_count is 1 (u3 via Batch-B)');
assert(c3Stats.completed_trainers_count === 0, 'Contest 3: completed_trainers_count is 0');
assert(c3Stats.completion_percentage === 0, 'Contest 3: completion_percentage is 0');

console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: 3-Tier Leaderboard Deterministic Sorting Standard
// ─────────────────────────────────────────────────────────────────────────────
console.log(`${colors.bold}${colors.magenta}▶ Suite 4: Leaderboard Deterministic Sorting Standard${colors.reset}`);

const participants = [
  { name: 'Zack', score: 100, solved: 5 },
  { name: 'Alice', score: 100, solved: 5 },
  { name: 'Bob', score: 100, solved: 8 },    // Same score, more solved -> 1st
  { name: 'Charlie', score: 50, solved: 10 }, // Lower score -> below 100s
  { name: 'David', score: 50, solved: 2 },
  { name: 'Aaron', score: 50, solved: 2 },    // Tied with David on score & solved -> alphabetical
];

const tieBreakerSort = (a, b) => 
  (b.score - a.score) || 
  (b.solved - a.solved) || 
  (a.name || '').localeCompare(b.name || '');

const sorted = [...participants].sort(tieBreakerSort);

assert(sorted[0].name === 'Bob', '1st place: Bob (score 100, solved 8)');
assert(sorted[1].name === 'Alice', '2nd place: Alice (score 100, solved 5 - before Zack alphabetically)');
assert(sorted[2].name === 'Zack', '3rd place: Zack (score 100, solved 5 - after Alice alphabetically)');
assert(sorted[3].name === 'Charlie', '4th place: Charlie (score 50, solved 10)');
assert(sorted[4].name === 'Aaron', '5th place: Aaron (score 50, solved 2 - before David alphabetically)');
assert(sorted[5].name === 'David', '6th place: David (score 50, solved 2 - after Aaron alphabetically)');

console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: Field Sanitization & Username Normalization Stress
// ─────────────────────────────────────────────────────────────────────────────
console.log(`${colors.bold}${colors.magenta}▶ Suite 5: Field Sanitization & Username Normalization${colors.reset}`);

// Username parsing
assert(parseHackerrankUsername('https://www.hackerrank.com/profile/johndoe') === 'johndoe', 'Full profile URL parsed');
assert(parseHackerrankUsername('https://www.hackerrank.com/hackers/johndoe/scores') === 'johndoe', 'Hackers URL with subpath parsed');
assert(parseHackerrankUsername('@johndoe') === 'johndoe', '@handle parsed');
assert(parseHackerrankUsername('  johndoe  ') === 'johndoe', 'Padded handle parsed');
assert(parseHackerrankUsername('N/A') === null, 'Placeholder N/A parsed to null');
assert(parseHackerrankUsername('nil') === null, 'Placeholder nil parsed to null');
assert(parseHackerrankUsername('-') === null, 'Placeholder - parsed to null');
assert(parseHackerrankUsername(null) === null, 'null parsed to null');

// Generic field sanitization
assert(sanitizeField('  John Doe  ') === 'John Doe', 'Text trimmed correctly');
assert(sanitizeField('n/a') === null, 'n/a sanitized to null');
assert(sanitizeField('UNDEFINED') === null, 'UNDEFINED sanitized to null');
assert(sanitizeField('') === null, 'Empty string sanitized to null');
assert(sanitizeField(null) === null, 'null sanitized to null');

console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY REPORT
// ─────────────────────────────────────────────────────────────────────────────
console.log(`${colors.bold}${colors.cyan}----------------------------------------------------------------------${colors.reset}`);
console.log(`${colors.bold}Adversarial Stress Test Summary:${colors.reset}`);
console.log(`  Total Invariant Checks: ${totalChecks}`);
console.log(`  Passed Checks:          ${colors.green}${colors.bold}${passedChecks}${colors.reset}`);
console.log(`  Failed Checks:          ${failedChecks > 0 ? colors.red + colors.bold + failedChecks : '0'}${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

if (failedChecks > 0) {
  console.log(`${colors.red}${colors.bold}FAILURES DETECTED:${colors.reset}`);
  failures.forEach(f => console.log(`  - ${f.testName}: ${f.details}`));
  process.exit(1);
} else {
  console.log(`${colors.green}${colors.bold}✔ ALL ADVERSARIAL STRESS CHECKS PASSED PERFECTLY${colors.reset}\n`);
  process.exit(0);
}
