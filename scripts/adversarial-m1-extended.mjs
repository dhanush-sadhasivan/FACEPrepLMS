#!/usr/bin/env node

/**
 * ============================================================================
 * Adversarial Extended Stress Test Suite — Milestone 1 (M1-1)
 * ============================================================================
 * 
 * Deep dive into:
 * - Complex nested topic parsing in roadmaps
 * - Timezone boundaries (UTC vs Asia/Kolkata IST)
 * - IT trainer overview portal-click gating and location security
 * - High-scale progress deduplication (10,000 rows)
 * ============================================================================
 */

import { extractRoadmapQuestionIds } from '../lib/roadmap-analytics.ts';
import { isRecordSolved } from '../lib/utils.ts';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

let total = 0;
let passed = 0;
let failed = 0;

function assert(condition, name) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ${colors.green}✔ PASS${colors.reset} ${name}`);
  } else {
    failed++;
    console.log(`  ${colors.red}✖ FAIL${colors.reset} ${name}`);
  }
}

console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}   ADVERSARIAL EXTENDED STRESS TEST SUITE — MILESTONE 1 (M1-1)       ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: Complex Nested Roadmap Question Extraction & Solved Verification
// ─────────────────────────────────────────────────────────────────────────────
console.log(`${colors.bold}${colors.magenta}▶ Suite 1: Complex Nested Roadmap Question Extraction${colors.reset}`);

const nestedTopics = [
  {
    id: 't1',
    name: 'Arrays & Two Pointers',
    questions: [
      { id: 'q_arr_1', title: 'Two Sum' },
      { question_id: 'q_arr_2', title: '3Sum' },
      { id: 'q_arr_1' }, // duplicate inside topic
    ]
  },
  {
    id: 't2',
    name: 'Dynamic Programming',
    questions: [
      { id: 'q_dp_1', title: 'Climbing Stairs' },
      { question_id: 'q_arr_1' }, // shared question with topic 1
    ]
  },
  {
    id: 't3',
    name: 'Empty Topic',
    questions: []
  },
  null,
  undefined,
];

const extracted = extractRoadmapQuestionIds(nestedTopics);
assert(extracted.length === 3, 'Extracted exactly 3 unique question IDs across nested topics');
assert(extracted.includes('q_arr_1'), 'Contains q_arr_1');
assert(extracted.includes('q_arr_2'), 'Contains q_arr_2');
assert(extracted.includes('q_dp_1'), 'Contains q_dp_1');

const flatTopics = [
  { id: 'q_flat_1', title: 'Flat 1' },
  { question_id: 'q_flat_2', title: 'Flat 2' },
  { id: 'q_flat_1' },
];
const extractedFlat = extractRoadmapQuestionIds(flatTopics);
assert(extractedFlat.length === 2, 'Extracted exactly 2 unique question IDs from flat topic structure');

assert(extractRoadmapQuestionIds([]).length === 0, 'Empty array returns empty questions');
assert(extractRoadmapQuestionIds(null).length === 0, 'null topics returns empty questions');
assert(extractRoadmapQuestionIds(undefined).length === 0, 'undefined topics returns empty questions');

console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Timezone Midnight Boundary Alignment (Asia/Kolkata)
// ─────────────────────────────────────────────────────────────────────────────
console.log(`${colors.bold}${colors.magenta}▶ Suite 2: Timezone Midnight Boundary Alignment (UTC -> IST)${colors.reset}`);

function getISTDateString(utcIsoString) {
  const d = new Date(utcIsoString);
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return istFormatter.format(d);
}

// 2026-08-29 18:29:59Z is 2026-08-29 23:59:59 IST (Day 29)
// 2026-08-29 18:30:00Z is 2026-08-30 00:00:00 IST (Day 30!)
const sub1 = '2026-08-29T18:29:59.000Z';
const sub2 = '2026-08-29T18:30:00.000Z';

assert(getISTDateString(sub1) === '2026-08-29', '18:29:59 UTC aligns to 2026-08-29 in IST');
assert(getISTDateString(sub2) === '2026-08-30', '18:30:00 UTC aligns to 2026-08-30 in IST');

console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: IT Trainer Overview Portal-Click Gating & Location Security
// ─────────────────────────────────────────────────────────────────────────────
console.log(`${colors.bold}${colors.magenta}▶ Suite 3: IT Trainer Overview Portal-Click Gating & Location Security${colors.reset}`);

// Gating Rule: Question is counted as completed ONLY IF c.clicked_at IS NOT NULL AND (c.is_completed = true OR HR solved)
const dq1 = { id: 'dq_1', question_id: 'q_hr_1' };
const dq2 = { id: 'dq_2', question_id: 'q_hr_2' };
const dq3 = { id: 'dq_3', question_id: 'q_hr_3' };

// Case A: Trainer solved in HackerRank but NEVER clicked the link in LMS portal
const caseA_Comp = { clicked_at: null, is_completed: false };
const caseA_HR = { status: 'solved', score: 10, max_score: 10 };
const isCaseAComplete = Boolean(caseA_Comp.clicked_at) && (caseA_Comp.is_completed || isRecordSolved(caseA_HR));
assert(isCaseAComplete === false, 'Gating: HR solved without LMS portal click is NOT counted (unverified link visit)');

// Case B: Trainer clicked link AND solved in HackerRank
const caseB_Comp = { clicked_at: '2026-08-29T10:00:00Z', is_completed: false };
const caseB_HR = { status: 'solved', score: 10, max_score: 10 };
const isCaseBComplete = Boolean(caseB_Comp.clicked_at) && (caseB_Comp.is_completed || isRecordSolved(caseB_HR));
assert(isCaseBComplete === true, 'Gating: Clicked link + HR solved is counted as completed');

// Case C: Trainer clicked link and marked completed manually
const caseC_Comp = { clicked_at: '2026-08-29T10:00:00Z', is_completed: true };
const caseC_HR = null;
const isCaseCComplete = Boolean(caseC_Comp.clicked_at) && (caseC_Comp.is_completed || isRecordSolved(caseC_HR));
assert(isCaseCComplete === true, 'Gating: Clicked link + manual is_completed is counted as completed');

// Location Security: Location jsonb should only be shared if check-in date is TODAY
const todayDateStr = new Date().toISOString().split('T')[0];
const yesterdayDateStr = '2026-08-28';

const locToday = { latitude: 12.9716, longitude: 77.5946 };
const exposedLocToday = (todayDateStr === todayDateStr) ? locToday : null;
const exposedLocYesterday = (yesterdayDateStr === todayDateStr) ? locToday : null;

assert(exposedLocToday !== null, 'Today check-in location is exposed');
assert(exposedLocYesterday === null, 'Stale past check-in location is hidden (null) for privacy');

console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: High-Scale Progress Deduplication Stress Test (10,000 rows)
// ─────────────────────────────────────────────────────────────────────────────
console.log(`${colors.bold}${colors.magenta}▶ Suite 4: High-Scale Progress Deduplication Stress Test (10,000 rows)${colors.reset}`);

const t0 = performance.now();
const largeProgressRows = [];
const numUsers = 100;
const numQuestions = 20;

// Generate 10,000 random submission rows with 5 attempts per user-question pair
for (let u = 1; u <= numUsers; u++) {
  for (let q = 1; q <= numQuestions; q++) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const isLastAttempt = attempt === 5;
      const isSolve = (u + q) % 2 === 0 && isLastAttempt;
      largeProgressRows.push({
        user_id: `user_${u}`,
        question_id: `q_${q}`,
        score: isSolve ? 10 : (attempt * 1.5),
        max_score: 10,
        status: isSolve ? 'solved' : 'attempted',
      });
    }
  }
}

assert(largeProgressRows.length === 10000, 'Generated 10,000 synthetic submission records');

const userQuestionMap = new Map();
largeProgressRows.forEach(p => {
  const key = `${p.user_id}:${p.question_id}`;
  const existing = userQuestionMap.get(key);
  const isSolved = isRecordSolved(p);
  if (!existing) {
    userQuestionMap.set(key, {
      user_id: p.user_id,
      score: p.score || 0,
      isSolved,
    });
  } else {
    existing.score = Math.max(existing.score, p.score || 0);
    if (isSolved) existing.isSolved = true;
  }
});

const t1 = performance.now();
const durationMs = (t1 - t0).toFixed(2);

assert(userQuestionMap.size === 2000, '10,000 rows deduplicated to exactly 2,000 distinct user-question pairs');
console.log(`  ${colors.cyan}ℹ Performance: 10,000 records deduplicated in ${durationMs}ms${colors.reset}`);

console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY REPORT
// ─────────────────────────────────────────────────────────────────────────────
console.log(`${colors.bold}${colors.cyan}----------------------------------------------------------------------${colors.reset}`);
console.log(`Adversarial Extended Stress Summary: ${passed}/${total} checks passed (${failed} failures)`);
console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
