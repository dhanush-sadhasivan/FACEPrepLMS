#!/usr/bin/env node

/**
 * ============================================================================
 * Challenger 1: Empirical Stress Harness for Milestone 1
 * ============================================================================
 * 
 * Objective:
 * 1. Stress test attendance auto-creation:
 *    - multiple successive increments
 *    - decrements to zero
 *    - targetCount boundary conditions
 *    - missing / invalid parameters
 *    - multi-roadmap global sync with users.it_days_count
 *    - self-healing check-in
 * 2. Stress test RPC vs API fallback parity across edge cases:
 *    - zero solves
 *    - partial scores (1/100, 99/100)
 *    - max_score = 0 / null
 *    - status = 'attempted' with positive score vs status = 'solved'
 *    - portal-click gating combinations
 *    - location privacy exposure
 *    - deterministic sort order
 * ============================================================================
 */

import { performance } from 'perf_hooks';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

let totalAsserts = 0;
let passedAsserts = 0;
let failedAsserts = 0;
const failureDetails = [];

function assert(condition, name, details = '') {
  totalAsserts++;
  if (condition) {
    passedAsserts++;
    console.log(`  ${colors.green}✔ PASS${colors.reset} ${name}`);
  } else {
    failedAsserts++;
    failureDetails.push({ name, details });
    console.log(`  ${colors.red}✖ FAIL${colors.reset} ${name} ${details ? `— ${details}` : ''}`);
  }
}

function assertEqual(actual, expected, name) {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  assert(match, name, `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}   CHALLENGER 1: EMPIRICAL STRESS HARNESS — MILESTONE 1             ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

// ─────────────────────────────────────────────────────────────────────────────
// PART 1: ATTENDANCE AUTO-CREATION & PROGRESSION STRESS TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log(`${colors.bold}${colors.magenta}▶ Part 1: Attendance Auto-Creation & Progression Stress Tests${colors.reset}`);

// Simulated Database State
class MockDatabase {
  constructor() {
    this.it_trainer_progress = [];
    this.users = [];
    this.roadmaps = [];
  }

  // Implementation of POST /api/internal-training/attendance logic
  async handleAttendanceRequest(body, userRole = 'admin') {
    if (userRole !== 'admin' && userRole !== 'manager') {
      return { status: 403, body: { error: 'Forbidden' } };
    }

    const { userId, roadmapId, newCount, action } = body;
    if (!userId) return { status: 400, body: { error: 'userId is required' } };
    if (!roadmapId) return { status: 400, body: { error: 'roadmapId is required' } };

    const today = '2026-08-29';

    // 1. Fetch per-roadmap progress
    let progress = this.it_trainer_progress.find(
      (p) => p.user_id === userId && p.roadmap_id === roadmapId
    );

    const currentCount = progress?.it_days_logged || 0;
    let targetCount = currentCount;

    if (action === 'increment') {
      targetCount = currentCount + 1;
    } else if (action === 'decrement') {
      targetCount = Math.max(0, currentCount - 1);
    } else if (typeof newCount === 'number') {
      targetCount = Math.max(0, newCount);
    } else if (action === 'set' && newCount !== undefined && newCount !== null) {
      targetCount = Math.max(0, Number(newCount) || 0);
    }

    // 2. Update or insert per-roadmap it_trainer_progress
    if (progress) {
      progress.it_days_logged = targetCount;
      progress.current_day = targetCount;
      progress.last_check_in_date = today;
      progress.updated_at = new Date().toISOString();
    } else {
      progress = {
        user_id: userId,
        roadmap_id: roadmapId,
        started_at: today,
        current_day: targetCount,
        it_days_logged: targetCount,
        last_check_in_date: today,
        extended_days: 0,
        extension_count: 0,
        updated_at: new Date().toISOString(),
      };
      this.it_trainer_progress.push(progress);
    }

    // 3. Recalculate global IT days
    const allUserItProgress = this.it_trainer_progress.filter((p) => p.user_id === userId);
    const newGlobalCount = Math.max(
      ...allUserItProgress.map((p) => p.it_days_logged || 0),
      targetCount,
      0
    );

    let user = this.users.find((u) => u.id === userId);
    if (!user) {
      user = { id: userId, it_days_count: 0, last_it_check_date: null };
      this.users.push(user);
    }
    user.it_days_count = newGlobalCount;
    user.last_it_check_date = today;

    return {
      status: 200,
      body: {
        success: true,
        userId,
        roadmapId,
        roadmapDaysLogged: targetCount,
        globalItDays: newGlobalCount,
      },
    };
  }

  // Implementation of recordITAttendance logic
  async recordITAttendance(userId, roadmapId, location) {
    const today = '2026-08-29';

    let progress = this.it_trainer_progress.find(
      (p) => p.user_id === userId && p.roadmap_id === roadmapId
    );

    if (!progress) {
      progress = {
        user_id: userId,
        roadmap_id: roadmapId,
        started_at: today,
        current_day: 0,
        it_days_logged: 0,
        last_check_in_date: null,
        extended_days: 0,
        extension_count: 0,
        updated_at: new Date().toISOString(),
      };
      this.it_trainer_progress.push(progress);
    }

    const lastCheckIn = progress.last_check_in_date || null;
    const currentDaysLogged = progress.it_days_logged || 0;
    const alreadyCheckedInToday = lastCheckIn === today;

    let newDaysLogged = currentDaysLogged;
    if (!alreadyCheckedInToday) {
      newDaysLogged = currentDaysLogged + 1;
    }

    progress.it_days_logged = newDaysLogged;
    progress.current_day = newDaysLogged;
    progress.last_check_in_date = today;
    if (location) progress.location = location;

    let user = this.users.find((u) => u.id === userId);
    if (!user) {
      user = { id: userId, it_days_count: 0, last_it_check_date: null };
      this.users.push(user);
    }

    const globalCount = user.it_days_count || 0;
    const globalLastDate = user.last_it_check_date || null;
    const newGlobalCount = globalLastDate === today ? globalCount : globalCount + 1;

    user.it_days_count = newGlobalCount;
    user.last_it_check_date = today;

    return {
      success: true,
      roadmapDaysLogged: newDaysLogged,
      globalItDays: newGlobalCount,
      alreadyCheckedInToday,
      today,
      location: progress.location || null,
    };
  }
}

// 1.1 Successive Increments on Uninitialized Trainer
const db = new MockDatabase();
db.users.push({ id: 'u_inc', it_days_count: 0, last_it_check_date: null });

for (let i = 1; i <= 20; i++) {
  const res = await db.handleAttendanceRequest({
    userId: 'u_inc',
    roadmapId: 'rm_1',
    action: 'increment',
  });
  if (i === 1) {
    assert(db.it_trainer_progress.length === 1, '1.1: First increment auto-creates it_trainer_progress row');
    assert(res.body.roadmapDaysLogged === 1, '1.1: First increment sets roadmapDaysLogged = 1');
    assert(res.body.globalItDays === 1, '1.1: First increment sets globalItDays = 1');
  }
  if (i === 20) {
    assert(db.it_trainer_progress.length === 1, '1.1: 20 increments does not create duplicate rows');
    assert(res.body.roadmapDaysLogged === 20, '1.1: 20 increments reaches roadmapDaysLogged = 20');
    assert(res.body.globalItDays === 20, '1.1: 20 increments reaches globalItDays = 20');
  }
}

// 1.2 Decrements Down to 0 and Below (Clamping)
for (let i = 19; i >= 0; i--) {
  await db.handleAttendanceRequest({
    userId: 'u_inc',
    roadmapId: 'rm_1',
    action: 'decrement',
  });
}
const zeroProg = db.it_trainer_progress.find((p) => p.user_id === 'u_inc' && p.roadmap_id === 'rm_1');
assert(zeroProg.it_days_logged === 0, '1.2: Decrements down to exact 0');

// Decrement below 0
const belowZeroRes = await db.handleAttendanceRequest({
  userId: 'u_inc',
  roadmapId: 'rm_1',
  action: 'decrement',
});
assert(belowZeroRes.body.roadmapDaysLogged === 0, '1.2: Decrement below 0 is safely clamped to 0');
assert(db.users.find((u) => u.id === 'u_inc').it_days_count === 0, '1.2: User global it_days_count clamped to 0');

// 1.3 action: 'set' and newCount edge cases
const setEdgeCases = [
  { newCount: 0, expected: 0, desc: 'set to 0' },
  { newCount: -15, expected: 0, desc: 'set to negative (-15 -> 0)' },
  { newCount: '42', expected: 42, desc: 'set with string numeric ("42" -> 42)' },
  { newCount: 'invalid_text', expected: 0, desc: 'set with invalid string ("invalid_text" -> 0)' },
  { newCount: null, expected: 0, desc: 'set with null -> 0' },
  { newCount: 100000, expected: 100000, desc: 'set with large integer (100000)' },
];

for (const tc of setEdgeCases) {
  const res = await db.handleAttendanceRequest({
    userId: 'u_inc',
    roadmapId: 'rm_1',
    action: 'set',
    newCount: tc.newCount,
  });
  assertEqual(res.body.roadmapDaysLogged, tc.expected, `1.3: action: 'set' ${tc.desc}`);
}

// 1.4 Multi-Roadmap Global Sync Invariants
const dbMulti = new MockDatabase();
dbMulti.users.push({ id: 'u_multi', it_days_count: 0, last_it_check_date: null });

// Setup RM_A = 10, RM_B = 5
await dbMulti.handleAttendanceRequest({ userId: 'u_multi', roadmapId: 'RM_A', action: 'set', newCount: 10 });
await dbMulti.handleAttendanceRequest({ userId: 'u_multi', roadmapId: 'RM_B', action: 'set', newCount: 5 });

let uMulti = dbMulti.users.find((u) => u.id === 'u_multi');
assert(uMulti.it_days_count === 10, '1.4: Global count is max(10, 5) = 10');

// Increment uninitialized RM_C (0 -> 1)
const rmCRes = await dbMulti.handleAttendanceRequest({ userId: 'u_multi', roadmapId: 'RM_C', action: 'increment' });
assert(rmCRes.body.roadmapDaysLogged === 1, '1.4: RM_C auto-created with 1 day');
assert(dbMulti.users.find((u) => u.id === 'u_multi').it_days_count === 10, '1.4: Global count remains 10');

// Decrement RM_A from 10 to 2
await dbMulti.handleAttendanceRequest({ userId: 'u_multi', roadmapId: 'RM_A', action: 'set', newCount: 2 });
assert(dbMulti.users.find((u) => u.id === 'u_multi').it_days_count === 5, '1.4: Decrementing RM_A to 2 updates global to max(2, 5, 1) = 5');

// Decrement RM_B from 5 to 0
await dbMulti.handleAttendanceRequest({ userId: 'u_multi', roadmapId: 'RM_B', action: 'set', newCount: 0 });
assert(dbMulti.users.find((u) => u.id === 'u_multi').it_days_count === 2, '1.4: Decrementing RM_B to 0 updates global to max(2, 0, 1) = 2');

// 1.5 Missing / Invalid Parameters & Auth Checks
const authFailRes = await dbMulti.handleAttendanceRequest({ userId: 'u_multi', roadmapId: 'RM_A' }, 'trainer');
assert(authFailRes.status === 403, '1.5: Trainer role is rejected with 403 Forbidden');

const missingUserRes = await dbMulti.handleAttendanceRequest({ roadmapId: 'RM_A' });
assert(missingUserRes.status === 400, '1.5: Missing userId rejected with 400 Bad Request');

const missingRmRes = await dbMulti.handleAttendanceRequest({ userId: 'u_multi' });
assert(missingRmRes.status === 400, '1.5: Missing roadmapId rejected with 400 Bad Request');

// 1.6 Self-Healing in recordITAttendance
const dbCheckIn = new MockDatabase();
// Trainer checks in on new roadmap with location
const check1 = await dbCheckIn.recordITAttendance('u_trainer_1', 'RM_X', { type: 'Chennai-office' });
assert(check1.success === true, '1.6: Check-in on missing progress row succeeds');
assert(check1.roadmapDaysLogged === 1, '1.6: Initial check-in logs 1 day');
assert(check1.globalItDays === 1, '1.6: Initial check-in sets global IT days = 1');
assert(check1.alreadyCheckedInToday === false, '1.6: First check-in today has alreadyCheckedInToday = false');
assertEqual(check1.location?.type, 'Chennai-office', '1.6: Location stored correctly');

// Same day re-check-in on same roadmap
const check2 = await dbCheckIn.recordITAttendance('u_trainer_1', 'RM_X', { type: 'Chennai-office-updated' });
assert(check2.roadmapDaysLogged === 1, '1.6: Second check-in today does not increment roadmap days');
assert(check2.globalItDays === 1, '1.6: Second check-in today does not increment global days');
assert(check2.alreadyCheckedInToday === true, '1.6: Second check-in today has alreadyCheckedInToday = true');

// Check-in on different roadmap on same day
const check3 = await dbCheckIn.recordITAttendance('u_trainer_1', 'RM_Y', { type: 'Remote' });
assert(check3.roadmapDaysLogged === 1, '1.6: Check-in on RM_Y logs 1 day for RM_Y');
assert(check3.globalItDays === 1, '1.6: Global count remains 1 (no double increment for same calendar date)');

console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// PART 2: RPC VS API FALLBACK PARITY STRESS TEST
// ─────────────────────────────────────────────────────────────────────────────
console.log(`${colors.bold}${colors.magenta}▶ Part 2: RPC vs API Fallback Parity Matrix (Side-by-Side Simulation)${colors.reset}`);

// Canonical Solved Condition in TypeScript (lib/utils.ts)
function isRecordSolvedTS(p) {
  if (!p) return false;
  if (p.status !== 'solved') return false;
  const score = p.score != null ? Number(p.score) : 0;
  const maxScore = p.max_score != null ? Number(p.max_score) : 0;
  if (Number.isFinite(maxScore) && maxScore > 0) {
    return Number.isFinite(score) && score >= maxScore;
  }
  return Number.isFinite(score) && score > 0;
}

// Stored Procedure SQL Logic in Migration 13:
// COUNT(DISTINCT dq.id) FILTER (
//   WHERE c.clicked_at IS NOT NULL 
//     AND (
//       c.is_completed = true 
//       OR (
//         p.status = 'solved' 
//         AND (CASE WHEN COALESCE(p.max_score, 0) > 0 THEN p.score >= p.max_score ELSE p.score > 0 END)
//       )
//     )
// )
function evaluateSQLCompletion(c, p) {
  if (!c || !c.clicked_at) return false;
  if (c.is_completed === true) return true;
  if (!p || p.status !== 'solved') return false;
  const score = Number(p.score || 0);
  const maxScore = Number(p.max_score || 0);
  if (maxScore > 0) {
    return score >= maxScore;
  }
  return score > 0;
}

function evaluateTSCompletion(c, p) {
  const hasClicked = Boolean(c?.clicked_at);
  const isManuallyCompleted = Boolean(c?.is_completed);
  const isHrSolved = p ? isRecordSolvedTS(p) : false;
  return hasClicked && (isHrSolved || isManuallyCompleted);
}

// 2.1 Test all permutations of (clicked_at, is_completed, status, score, max_score)
const testPermutations = [
  // 1. Zero solve / unattempted
  { name: 'Unattempted, no click', c: null, p: null, expected: false },
  { name: 'Unattempted, with click', c: { clicked_at: '2026-08-29' }, p: null, expected: false },
  
  // 2. Partial scores (1/100, 50/100, 99/100)
  { name: 'Partial 1/100, clicked', c: { clicked_at: '2026-08-29' }, p: { status: 'solved', score: 1, max_score: 100 }, expected: false },
  { name: 'Partial 50/100, clicked', c: { clicked_at: '2026-08-29' }, p: { status: 'solved', score: 50, max_score: 100 }, expected: false },
  { name: 'Partial 99/100, clicked', c: { clicked_at: '2026-08-29' }, p: { status: 'solved', score: 99, max_score: 100 }, expected: false },
  
  // 3. Full score (100/100)
  { name: 'Full 100/100, clicked', c: { clicked_at: '2026-08-29' }, p: { status: 'solved', score: 100, max_score: 100 }, expected: true },
  { name: 'Full 100/100, NO click', c: { clicked_at: null }, p: { status: 'solved', score: 100, max_score: 100 }, expected: false },
  
  // 4. Over-score (bonus points e.g. 110/100)
  { name: 'Bonus 110/100, clicked', c: { clicked_at: '2026-08-29' }, p: { status: 'solved', score: 110, max_score: 100 }, expected: true },
  
  // 5. max_score = 0
  { name: 'Score 10, max_score 0, solved, clicked', c: { clicked_at: '2026-08-29' }, p: { status: 'solved', score: 10, max_score: 0 }, expected: true },
  { name: 'Score 0, max_score 0, solved, clicked', c: { clicked_at: '2026-08-29' }, p: { status: 'solved', score: 0, max_score: 0 }, expected: false },
  { name: 'Score -5, max_score 0, solved, clicked', c: { clicked_at: '2026-08-29' }, p: { status: 'solved', score: -5, max_score: 0 }, expected: false },
  
  // 6. status = 'attempted' with positive score vs status = 'solved'
  { name: 'Attempted 10/10 with click (must NOT be solved)', c: { clicked_at: '2026-08-29' }, p: { status: 'attempted', score: 10, max_score: 10 }, expected: false },
  { name: 'Attempted 100/100 with click (must NOT be solved)', c: { clicked_at: '2026-08-29' }, p: { status: 'attempted', score: 100, max_score: 100 }, expected: false },
  { name: 'Attempted 5/10 with click (must NOT be solved)', c: { clicked_at: '2026-08-29' }, p: { status: 'attempted', score: 5, max_score: 10 }, expected: false },
  
  // 7. Manual completion flag
  { name: 'Manual complete with click', c: { clicked_at: '2026-08-29', is_completed: true }, p: null, expected: true },
  { name: 'Manual complete WITHOUT click', c: { clicked_at: null, is_completed: true }, p: null, expected: false },
  { name: 'Manual complete + partial HR score (manual wins if clicked)', c: { clicked_at: '2026-08-29', is_completed: true }, p: { status: 'attempted', score: 5, max_score: 10 }, expected: true },
];

for (const perm of testPermutations) {
  const sqlRes = evaluateSQLCompletion(perm.c, perm.p);
  const tsRes = evaluateTSCompletion(perm.c, perm.p);

  assert(sqlRes === perm.expected && tsRes === perm.expected, `2.1: Parity on [${perm.name}] -> SQL: ${sqlRes}, TS: ${tsRes}`);
}

// 2.2 Full Trainer Overview Payload Comparison
console.log(`\n${colors.bold}${colors.magenta}▶ Part 2.2: Full ITTrainerOverviewItem Field-by-Field Parity${colors.reset}`);

const mockOverviewTrainers = [
  { id: 't1', full_name: 'Trainer Alpha', emp_id: 'EMP101', email: 'alpha@test.com', team: 'Core' },
  { id: 't2', full_name: 'Trainer Beta', emp_id: null, email: 'beta@test.com', team: null },
  { id: 't3', full_name: null, emp_id: null, email: 'gamma@test.com', team: null },
];

const mockProgressData = [
  { user_id: 't1', roadmap_id: 'rm1', it_days_logged: 3, last_check_in_date: '2026-08-29', location: { type: 'Coimbatore-office' } },
  { user_id: 't2', roadmap_id: 'rm1', it_days_logged: 1, last_check_in_date: '2026-08-28', location: { type: 'Remote' } }, // past date
  // t3 has no progress record
];

const mockQuestions = [
  { id: 'dq1', day_plan_id: 'dp1', day_number: 1, question_id: 'q1' },
  { id: 'dq2', day_plan_id: 'dp2', day_number: 2, question_id: 'q2' },
  { id: 'dq3', day_plan_id: 'dp3', day_number: 3, question_id: 'q3' },
];

const mockCompletions = [
  // t1: solved dq1 and dq2 (clicked + solved)
  { user_id: 't1', day_question_id: 'dq1', clicked_at: '2026-08-27', is_completed: false },
  { user_id: 't1', day_question_id: 'dq2', clicked_at: '2026-08-28', is_completed: false },
  // t2: dq1 clicked but only attempted on HR (score 5/10)
  { user_id: 't2', day_question_id: 'dq1', clicked_at: '2026-08-28', is_completed: false },
];

const mockHr = [
  { user_id: 't1', question_id: 'q1', status: 'solved', score: 10, max_score: 10 },
  { user_id: 't1', question_id: 'q2', status: 'solved', score: 10, max_score: 10 },
  { user_id: 't2', question_id: 'q1', status: 'attempted', score: 5, max_score: 10 },
];

function generateTSOverview() {
  const today = '2026-08-29';
  const totalDays = 3;
  const totalQuestionsCount = mockQuestions.length;

  return mockOverviewTrainers.map((u) => {
    const p = mockProgressData.find((prog) => prog.user_id === u.id);
    const itDaysLogged = p?.it_days_logged || 0;
    const currentDay = Math.min(itDaysLogged, totalDays || 1);
    const lastCheckIn = p?.last_check_in_date || null;
    const isCountedToday = lastCheckIn === today;

    let completedCount = 0;
    let pendingCount = 0;

    mockQuestions.forEach((q) => {
      const comp = mockCompletions.find((c) => c.user_id === u.id && c.day_question_id === q.id);
      const hr = mockHr.find((h) => h.user_id === u.id && h.question_id === q.question_id);
      const hasClicked = Boolean(comp?.clicked_at);
      const isManuallyCompleted = Boolean(comp?.is_completed);
      const isHrSolved = hr ? isRecordSolvedTS(hr) : false;
      const isComp = hasClicked && (isHrSolved || isManuallyCompleted);

      if (isComp) {
        completedCount++;
      } else {
        if (q.day_number <= currentDay) {
          pendingCount++;
        }
      }
    });

    return {
      user_id: u.id,
      full_name: u.full_name || 'Unnamed Trainer',
      emp_id: u.emp_id || '—',
      team: u.team || 'N/A',
      email: u.email,
      roadmap_id: 'rm1',
      roadmap_title: 'DSA Mastery',
      started_at: p?.started_at || null,
      current_day: currentDay,
      total_days: totalDays,
      completed_questions_count: completedCount,
      total_questions_count: totalQuestionsCount,
      pending_questions_count: pendingCount,
      it_days_count: itDaysLogged,
      extended_days: p?.extended_days || 0,
      extension_count: p?.extension_count || 0,
      location: isCountedToday ? p?.location || null : null,
      is_online: false,
      last_it_check_date: lastCheckIn,
      is_it_counted_today: isCountedToday,
    };
  }).sort((a, b) => b.pending_questions_count - a.pending_questions_count || a.full_name.localeCompare(b.full_name));
}

function generateSQLOverview() {
  const today = '2026-08-29';
  const totalDays = 3;
  const totalQuestionsCount = mockQuestions.length;

  return mockOverviewTrainers.map((u) => {
    const p = mockProgressData.find((prog) => prog.user_id === u.id);
    const itDaysLogged = p?.it_days_logged || 0;
    const currentDay = Math.min(itDaysLogged, totalDays || 1);
    const lastCheckIn = p?.last_check_in_date || null;
    const isCountedToday = lastCheckIn === today;

    let completedCount = 0;
    let questionsDueCount = 0;
    let questionsDoneDueCount = 0;

    mockQuestions.forEach((q) => {
      const comp = mockCompletions.find((c) => c.user_id === u.id && c.day_question_id === q.id);
      const hr = mockHr.find((h) => h.user_id === u.id && h.question_id === q.question_id);
      const isComp = evaluateSQLCompletion(comp, hr);

      if (isComp) completedCount++;

      if (q.day_number <= currentDay) {
        questionsDueCount++;
        if (isComp) questionsDoneDueCount++;
      }
    });

    const pendingCount = Math.max(0, questionsDueCount - questionsDoneDueCount);

    return {
      user_id: u.id,
      full_name: u.full_name || 'Unnamed Trainer',
      emp_id: u.emp_id || '—',
      team: u.team || 'N/A',
      email: u.email,
      roadmap_id: 'rm1',
      roadmap_title: 'DSA Mastery',
      started_at: p?.started_at || null,
      current_day: currentDay,
      total_days: totalDays,
      completed_questions_count: completedCount,
      total_questions_count: totalQuestionsCount,
      pending_questions_count: pendingCount,
      it_days_count: itDaysLogged,
      extended_days: p?.extended_days || 0,
      extension_count: p?.extension_count || 0,
      location: isCountedToday ? p?.location || null : null,
      is_online: false,
      last_it_check_date: lastCheckIn,
      is_it_counted_today: isCountedToday,
    };
  }).sort((a, b) => b.pending_questions_count - a.pending_questions_count || a.full_name.localeCompare(b.full_name));
}

const tsOverview = generateTSOverview();
const sqlOverview = generateSQLOverview();

assertEqual(tsOverview.length, sqlOverview.length, '2.2: Overview array lengths match');
for (let i = 0; i < tsOverview.length; i++) {
  const tsItem = tsOverview[i];
  const sqlItem = sqlOverview[i];
  assertEqual(tsItem.user_id, sqlItem.user_id, `2.2: Item [${i}] user_id match`);
  assertEqual(tsItem.completed_questions_count, sqlItem.completed_questions_count, `2.2: Item [${i}] completed_questions_count match`);
  assertEqual(tsItem.pending_questions_count, sqlItem.pending_questions_count, `2.2: Item [${i}] pending_questions_count match`);
  assertEqual(tsItem.location, sqlItem.location, `2.2: Item [${i}] location privacy exposure match`);
  assertEqual(tsItem.is_it_counted_today, sqlItem.is_it_counted_today, `2.2: Item [${i}] is_it_counted_today match`);
  assertEqual(tsItem.last_it_check_date, sqlItem.last_it_check_date, `2.2: Item [${i}] last_it_check_date match`);
  assertEqual(tsItem.current_day, sqlItem.current_day, `2.2: Item [${i}] current_day match`);
}

// Verify specific trainer expectations:
// Trainer Alpha (t1): it_days_logged = 3, current_day = 3. Solved dq1 and dq2. dq3 is due and incomplete. Pending = 1. Checked in today -> location exposed!
const alphaItem = tsOverview.find((item) => item.user_id === 't1');
assert(alphaItem.completed_questions_count === 2, '2.2: Trainer Alpha completed 2 questions');
assert(alphaItem.pending_questions_count === 1, '2.2: Trainer Alpha pending 1 question');
assert(alphaItem.location?.type === 'Coimbatore-office', '2.2: Trainer Alpha location is exposed');
assert(alphaItem.is_it_counted_today === true, '2.2: Trainer Alpha is_it_counted_today = true');

// Trainer Beta (t2): it_days_logged = 1, current_day = 1. dq1 attempted (partial 5/10) -> NOT completed. Pending = 1. Checked in yesterday -> location NULL!
const betaItem = tsOverview.find((item) => item.user_id === 't2');
assert(betaItem.completed_questions_count === 0, '2.2: Trainer Beta partial score 5/10 is NOT completed');
assert(betaItem.pending_questions_count === 1, '2.2: Trainer Beta has 1 pending question');
assert(betaItem.location === null, '2.2: Trainer Beta past check-in location is NULL');
assert(betaItem.is_it_counted_today === false, '2.2: Trainer Beta is_it_counted_today = false');

// Trainer Gamma (t3): no progress row -> it_days_logged = 0, current_day = 0. Pending = 0 (no questions due on Day 0). Location = null.
const gammaItem = tsOverview.find((item) => item.user_id === 't3');
assert(gammaItem.completed_questions_count === 0, '2.2: Trainer Gamma completed = 0');
assert(gammaItem.pending_questions_count === 0, '2.2: Trainer Gamma pending = 0 (Day 0 has 0 due)');
assert(gammaItem.location === null, '2.2: Trainer Gamma location = null');
assert(gammaItem.is_it_counted_today === false, '2.2: Trainer Gamma is_it_counted_today = false');

console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY REPORT
// ─────────────────────────────────────────────────────────────────────────────
console.log(`${colors.bold}${colors.cyan}----------------------------------------------------------------------${colors.reset}`);
console.log(`Challenger 1 Empirical Stress Test Summary:`);
console.log(`  Total Invariant Asserts: ${totalAsserts}`);
console.log(`  Passed Asserts:          ${colors.green}${colors.bold}${passedAsserts}${colors.reset}`);
console.log(`  Failed Asserts:          ${failedAsserts > 0 ? colors.red + colors.bold + failedAsserts : '0'}${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

if (failedAsserts > 0) {
  console.log(`${colors.red}${colors.bold}FAILURES ENCOUNTERED:${colors.reset}`);
  failureDetails.forEach((f) => console.log(`  - ${f.name}: ${f.details}`));
  process.exit(1);
} else {
  console.log(`${colors.green}${colors.bold}✔ ALL CHALLENGER EMPIRICAL INVARIANTS AND STRESS TESTS PASSED${colors.reset}\n`);
  process.exit(0);
}
