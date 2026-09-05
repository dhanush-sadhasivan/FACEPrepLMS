import {
  generateSecureTempPassword,
  safeTimingCompare,
  sanitizeCsvCell,
  sanitizeCsvRow,
  isValidIdentifier,
  isSafeRedirectUrl
} from '../lib/security.ts';

console.log('======================================================================');
console.log('   CHALLENGER 2: EMPIRICAL SECURITY STRESS & EDGE VALIDATION HARNESS  ');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;

function assertTest(name, cond, details = '') {
  if (cond) {
    passed++;
    console.log('  [PASS] ' + name);
  } else {
    failed++;
    const msg = '  [FAIL] ' + name + (details ? ' - ' + details : '');
    console.log(msg);
  }
}

// 1. PRNG PASSWORD ENTROPY (1,000 Iterations)
console.log('--- 1. PRNG Password Entropy & Uniqueness (1,000 iterations) ---');
const pwds = new Set();
let all19Len = true;
let allContainUppercase = true;
let allContainDigits = true;
let allContainSymbols = true;
let allContainLowercase = true;
const hexFreq = {};

for (let i = 0; i < 1000; i++) {
  const p = generateSecureTempPassword();
  pwds.add(p);
  if (p.length !== 19) all19Len = false;
  if (!/[A-Z]/.test(p)) allContainUppercase = false;
  if (!/[0-9]/.test(p)) allContainDigits = false;
  if (!/[!@#$%^&*]/.test(p)) allContainSymbols = false;
  if (!/^[0-9a-f]{16}/.test(p)) allContainLowercase = false;
  for (const ch of p.slice(0, 16)) {
    hexFreq[ch] = (hexFreq[ch] || 0) + 1;
  }
}

assertTest('1,000 / 1,000 unique passwords generated (0 collisions)', pwds.size === 1000, 'Count: ' + pwds.size);
assertTest('All 1,000 passwords strictly length 19 (16 hex chars + A1! suffix)', all19Len);
assertTest('All 1,000 passwords contain uppercase characters (A-Z)', allContainUppercase);
assertTest('All 1,000 passwords contain numeric characters (0-9)', allContainDigits);
assertTest('All 1,000 passwords contain symbol characters (!)', allContainSymbols);
assertTest('All 1,000 passwords have valid hex character prefixes', allContainLowercase);

let chi2 = 0;
const expectedCount = 16000 / 16;
for (let d = 0; d < 16; d++) {
  const h = d.toString(16);
  const obs = hexFreq[h] || 0;
  chi2 += Math.pow(obs - expectedCount, 2) / expectedCount;
}
console.log('  -> 16-bin Chi-Square across 16,000 hex characters: ' + chi2.toFixed(3) + ' (critical threshold < 37.7 at alpha=0.001)');
assertTest('PRNG character distribution satisfies uniform randomness (Chi-Square < 37.7)', chi2 < 37.7, 'Chi2 = ' + chi2.toFixed(3));

// 2. CONSTANT-TIME COMPARISON
console.log('\n--- 2. Constant-Time Comparison (safeTimingCompare) ---');
assertTest('Identical short strings -> true', safeTimingCompare('admin_token_2026', 'admin_token_2026') === true);
assertTest('Identical 10KB strings -> true', safeTimingCompare('X'.repeat(10000), 'X'.repeat(10000)) === true);
assertTest('Differing same-length strings -> false', safeTimingCompare('admin_token_2026', 'admin_token_2027') === false);
assertTest('Variable length (short vs long) -> false', safeTimingCompare('short', 'much_longer_secret_string') === false);
assertTest('Variable length (prefix match with extra byte) -> false', safeTimingCompare('secret', 'secret1') === false);
assertTest('Variable length (suffix match with missing byte) -> false', safeTimingCompare('secret1', 'secret') === false);
assertTest('Empty string a vs non-empty -> false', safeTimingCompare('', 'secret') === false);
assertTest('Non-empty vs empty string b -> false', safeTimingCompare('secret', '') === false);
assertTest('Both empty strings (\'\', \'\') -> false (fail-closed invariant)', safeTimingCompare('', '') === false);
assertTest('Identical Unicode & Emoji strings -> true', safeTimingCompare('🛡️🔒Pass@123', '🛡️🔒Pass@123') === true);
assertTest('Differing Unicode & Emoji strings -> false', safeTimingCompare('🛡️🔒Pass@123', '🛡️⚔️Pass@123') === false);
assertTest('Null input on param a -> false without throwing', safeTimingCompare(null, 'secret') === false);
assertTest('Undefined input on param b -> false without throwing', safeTimingCompare('secret', undefined) === false);
assertTest('Number input -> false without throwing', safeTimingCompare(12345, 12345) === false);
assertTest('Object / Array inputs -> false without throwing', safeTimingCompare({}, {}) === false && safeTimingCompare([], []) === false);

// 3. CSV FORMULA INJECTION SANITIZATION
console.log('\n--- 3. CSV Formula Injection Prefix Sanitization ---');
const dangerousPrefixes = [
  { prefix: '=', payload: "=cmd|'/C calc'!A0", expected: "'=cmd|'/C calc'!A0" },
  { prefix: '+', payload: '+SUM(A1:A10)', expected: "'+SUM(A1:A10)" },
  { prefix: '-', payload: "-1+2+cmd|'/C calc'!A0", expected: "'-1+2+cmd|'/C calc'!A0" },
  { prefix: '@', payload: '@SUM(B1:B10)', expected: "'@SUM(B1:B10)" },
  { prefix: '\\t', payload: '\t=1+1', expected: "'\t=1+1" },
  { prefix: '\\r', payload: '\r=1+1', expected: "'\r=1+1" },
];

for (const { prefix, payload, expected } of dangerousPrefixes) {
  const result = sanitizeCsvCell(payload);
  assertTest('Sanitizes prefix [' + prefix + ']: ' + payload.slice(0, 15) + '...', result === expected, 'Expected ' + expected + ', got ' + result);
}

const newlinePayload = '\n=1+1';
const newlineResult = sanitizeCsvCell(newlinePayload);
console.log('  -> Note on \\n prefix: ' + JSON.stringify(newlinePayload) + ' -> ' + JSON.stringify(newlineResult) + ' (formulaChars in security.ts: [=, +, -, @, \\t, \\r])');

assertTest('Benign alphanumeric string untouched', sanitizeCsvCell('Alice Johnson') === 'Alice Johnson');
assertTest('Benign email address untouched', sanitizeCsvCell('alice@example.com') === 'alice@example.com');
assertTest('Null returns empty string', sanitizeCsvCell(null) === '');
assertTest('Undefined returns empty string', sanitizeCsvCell(undefined) === '');
assertTest('Number converts to string', sanitizeCsvCell(42) === '42');

const rawRow = {
  name: '=DDE("cmd";"/C calc";"__dummy__")!A0',
  score: 100,
  active: true,
  notes: '+HYPERLINK("http://evil.com","Click here")',
  metadata: null,
  emptyField: undefined,
  team: 'Core Team'
};
const sanitizedRow = sanitizeCsvRow(rawRow);
assertTest('sanitizeCsvRow escapes malicious formula in name', sanitizedRow.name.startsWith("'="));
assertTest('sanitizeCsvRow escapes malicious formula in notes', sanitizedRow.notes.startsWith("'+H"));
assertTest('sanitizeCsvRow preserves numeric types', sanitizedRow.score === 100 && typeof sanitizedRow.score === 'number');
assertTest('sanitizeCsvRow preserves boolean types', sanitizedRow.active === true && typeof sanitizedRow.active === 'boolean');
assertTest('sanitizeCsvRow preserves null metadata', sanitizedRow.metadata === null);
assertTest('sanitizeCsvRow preserves benign string team', sanitizedRow.team === 'Core Team');

// 4. SSRF & OPEN REDIRECT VALIDATION
console.log('\n--- 4. SSRF & URL Validation Edge Cases (isSafeRedirectUrl) ---');

const ssrfEdgeCases = [
  { url: 'http://169.254.169.254', expected: false, reason: 'AWS/GCP/Azure link-local metadata IP (HTTP)' },
  { url: 'https://169.254.169.254', expected: false, reason: 'AWS/GCP/Azure link-local metadata IP (HTTPS)' },
  { url: 'http://169.254.169.254/latest/meta-data/', expected: false, reason: 'Metadata full path' },
  { url: 'http://127.0.0.1', expected: false, reason: 'IPv4 loopback HTTP' },
  { url: 'https://127.0.0.1', expected: false, reason: 'IPv4 loopback HTTPS' },
  { url: 'https://127.0.0.1:8080/admin', expected: false, reason: 'Loopback with custom port' },
  { url: 'http://localhost', expected: false, reason: 'Localhost HTTP' },
  { url: 'https://localhost', expected: false, reason: 'Localhost HTTPS' },
  { url: 'https://localhost:3000', expected: false, reason: 'Localhost with port' },
  { url: 'https://0.0.0.0', expected: false, reason: '0.0.0.0 non-routable address' },
  { url: 'https://::1', expected: false, reason: 'IPv6 loopback address' },
  { url: 'https://10.0.0.1', expected: false, reason: 'Private 10.0.0.0/8' },
  { url: 'https://172.16.0.1', expected: false, reason: 'Private 172.16.0.0/12' },
  { url: 'https://172.31.255.255', expected: false, reason: 'Private 172.31.255.255/12 boundary' },
  { url: 'https://192.168.1.1', expected: false, reason: 'Private 192.168.0.0/16' },
  { url: 'https://hackerrank.com.evil.com', expected: false, reason: 'Suffix evasion attack' },
  { url: 'https://evilhackerrank.com', expected: false, reason: 'Prefix domain evasion' },
  { url: 'https://leetcode.com.attacker.io', expected: false, reason: 'LeetCode suffix evasion' },
  { url: 'https://github.com.fake.com', expected: false, reason: 'GitHub suffix evasion' },
  { url: 'https://faceprep.in.phishing.net', expected: false, reason: 'FACEPrep suffix evasion' },
  { url: 'javascript:alert(document.cookie)', expected: false, reason: 'JavaScript URI XSS' },
  { url: 'data:text/html,<script>alert(1)</script>', expected: false, reason: 'Data URI XSS' },
  { url: 'vbscript:msgbox(1)', expected: false, reason: 'VBScript scheme' },
  { url: 'file:///etc/passwd', expected: false, reason: 'Local file scheme' },
  { url: 'ftp://hackerrank.com', expected: false, reason: 'FTP scheme on valid domain' },
  { url: 'ws://hackerrank.com', expected: false, reason: 'WebSocket scheme on valid domain' },
  { url: '//evil.com', expected: false, reason: 'Protocol-relative double slash' },
  { url: '///evil.com', expected: false, reason: 'Triple slash protocol-relative bypass' },
  { url: 'https://evil.com', expected: false, reason: 'Unlisted external domain' },
  { url: 'https://google.com', expected: false, reason: 'External non-platform domain' },
  { url: 'https://hackerrank.com/contests/weekly-1', expected: true, reason: 'Legitimate HackerRank contest URL' },
  { url: 'https://www.hackerrank.com/challenges/solve', expected: true, reason: 'Legitimate www.hackerrank.com' },
  { url: 'https://support.hackerrank.com', expected: true, reason: 'HackerRank official subdomain' },
  { url: 'https://leetcode.com/problems/two-sum', expected: true, reason: 'Legitimate LeetCode URL' },
  { url: 'https://github.com/faceprep/repo', expected: true, reason: 'Legitimate GitHub URL' },
  { url: 'https://faceprep.in/dashboard', expected: true, reason: 'Legitimate FACEPrep URL' },
  { url: 'https://app.faceprep.in', expected: true, reason: 'Legitimate FACEPrep subdomain' },
  { url: '/dashboard', expected: true, reason: 'Relative dashboard path' },
  { url: '/contests/weekly-1', expected: true, reason: 'Relative contest path' },
  { url: '/reports?type=it', expected: true, reason: 'Relative report with query string' },
  { url: '/', expected: true, reason: 'Root relative path' },
  { url: '', expected: false, reason: 'Empty string' },
  { url: '   ', expected: false, reason: 'Whitespace string' },
  { url: null, expected: false, reason: 'Null input' },
  { url: undefined, expected: false, reason: 'Undefined input' },
];

for (const { url, expected, reason } of ssrfEdgeCases) {
  const result = isSafeRedirectUrl(url);
  const displayUrl = typeof url === 'string' ? (url.length > 40 ? url.slice(0, 37) + '...' : url) : String(url);
  assertTest('SSRF Guard: ' + displayUrl + ' => ' + expected + ' [' + reason + ']', result === expected, 'Expected ' + expected + ', got ' + result);
}

// 5. IDENTIFIER VALIDATION
console.log('\n--- 5. Identifier Validation Edge Cases (isValidIdentifier) ---');

const identifierCases = [
  { input: 'john_doe', expected: true, reason: 'Alphanumeric with underscore' },
  { input: 'contest-2026-week-1', expected: true, reason: 'Alphanumeric with hyphen' },
  { input: 'Admin123', expected: true, reason: 'Mixed case alphanumeric' },
  { input: 'user@domain.com', expected: false, reason: 'Special character @' },
  { input: 'user name', expected: false, reason: 'Whitespace in identifier' },
  { input: 'hackerrank.com/user', expected: false, reason: 'Path separators / and .' },
  { input: '<script>alert(1)</script>', expected: false, reason: 'HTML/XSS tags' },
  { input: 'user; DROP TABLE users;--', expected: false, reason: 'SQL injection payload' },
  { input: '', expected: false, reason: 'Empty string' },
  { input: null, expected: false, reason: 'Null' },
  { input: undefined, expected: false, reason: 'Undefined' }
];

for (const { input, expected, reason } of identifierCases) {
  const result = isValidIdentifier(input);
  assertTest('isValidIdentifier: "' + input + '" => ' + expected + ' [' + reason + ']', result === expected);
}

console.log('\n======================================================================');
console.log('Challenger 2 Validation Summary:');
console.log('  Total Checks:   ' + (passed + failed));
console.log('  Passed Checks:  ' + passed);
console.log('  Failed Checks:  ' + failed);
console.log('======================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}