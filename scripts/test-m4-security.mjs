import assert from 'assert';
import { isSafeRedirectUrl, isValidIdentifier, sanitizeCsvCell, sanitizeCsvRow } from '../lib/security.ts';

console.log('Testing M4 Security Components...');

// 1. SSRF & Redirect Protection Tests
assert.strictEqual(isSafeRedirectUrl('http://127.0.0.1/admin'), false, 'Should reject 127.0.0.1');
assert.strictEqual(isSafeRedirectUrl('http://localhost:3000'), false, 'Should reject localhost');
assert.strictEqual(isSafeRedirectUrl('http://169.254.169.254/latest/meta-data'), false, 'Should reject cloud metadata IP');
assert.strictEqual(isSafeRedirectUrl('https://10.0.0.1/secret'), false, 'Should reject 10.x.x.x');
assert.strictEqual(isSafeRedirectUrl('https://172.20.0.5/api'), false, 'Should reject 172.16-31.x.x');
assert.strictEqual(isSafeRedirectUrl('https://192.168.1.1/router'), false, 'Should reject 192.168.x.x');
assert.strictEqual(isSafeRedirectUrl('http://hackerrank.com'), false, 'Should reject plain http');
assert.strictEqual(isSafeRedirectUrl('https://evil-site.com'), false, 'Should reject unallowed domain');
assert.strictEqual(isSafeRedirectUrl('https://hackerrank.com/challenges/two-sum'), true, 'Should allow hackerrank.com');
assert.strictEqual(isSafeRedirectUrl('https://www.hackerrank.com/contests/c1'), true, 'Should allow www.hackerrank.com');
assert.strictEqual(isSafeRedirectUrl('https://leetcode.com/problems/two-sum'), true, 'Should allow leetcode.com');
assert.strictEqual(isSafeRedirectUrl('https://www.leetcode.com/problems/3sum'), true, 'Should allow www.leetcode.com');
assert.strictEqual(isSafeRedirectUrl('/internal-training'), true, 'Should allow relative path');
console.log('✅ SSRF & Open Redirect Protection assertions passed!');

// 2. CSV / Excel Formula Injection Tests
assert.strictEqual(sanitizeCsvCell('=CMD("calc")'), '\'=CMD("calc")', 'Should prefix = with quote');
assert.strictEqual(sanitizeCsvCell('+SUM(A1:B1)'), '\'+SUM(A1:B1)', 'Should prefix + with quote');
assert.strictEqual(sanitizeCsvCell('-5+2'), '\'-5+2', 'Should prefix - with quote');
assert.strictEqual(sanitizeCsvCell('@IMPORT(...)'), '\'@IMPORT(...)', 'Should prefix @ with quote');
assert.strictEqual(sanitizeCsvCell('\tTabPrefix'), '\'\tTabPrefix', 'Should prefix tab with quote');
assert.strictEqual(sanitizeCsvCell('Normal Text'), 'Normal Text', 'Should keep normal text unchanged');
assert.strictEqual(sanitizeCsvCell(null), '', 'Should return empty string for null');

const rowObj = { name: '=CMD("calc")', score: 100, team: '+Finance' };
const sanitizedObj = sanitizeCsvRow(rowObj);
assert.strictEqual(sanitizedObj.name, '\'=CMD("calc")');
assert.strictEqual(sanitizedObj.score, 100);
assert.strictEqual(sanitizedObj.team, '\'+Finance');
console.log('✅ CSV / Excel Formula Injection assertions passed!');

// 3. Identifier Validation
assert.strictEqual(isValidIdentifier('valid-slug_123'), true);
assert.strictEqual(isValidIdentifier('bad slug with spaces'), false);
assert.strictEqual(isValidIdentifier('slug/with/slash'), false);
assert.strictEqual(isValidIdentifier('slug;drop table'), false);
console.log('✅ Identifier validation assertions passed!');

console.log('\n🎉 ALL M4 SECURITY UNIT ASSERTIONS PASSED SUCCESSFULLY!');
