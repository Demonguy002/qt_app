import fs from 'node:fs';
import assert from 'node:assert/strict';
import { recalculateStreaks, currentStreak } from '../src/lib/storage.js';

const bank = JSON.parse(fs.readFileSync(new URL('../public/question-bank.json', import.meta.url), 'utf8'));
assert.equal(bank.pageCount, 737);
assert.equal(bank.topics.length, 39);
assert.equal(bank.questions.length, 21);
for (const q of bank.questions) {
  assert.ok(q.questionVerified && q.answerVerified && q.solutionVerified, `unverified question ${q.id}`);
  assert.equal(q.options.length, 4, `question ${q.id} must have four options`);
  assert.ok(q.options.some(o => o.label === q.answer), `answer letter missing for ${q.id}`);
  assert.ok(q.solution.trim().length > 0, `solution missing for ${q.id}`);
}
const q29 = bank.questions.find(q => q.number === 29);
assert.equal(q29.stem, '217 x 217 + 183 x 183 = ?');
assert.deepEqual(q29.options.map(o => o.text), ['79698', '80578', '80698', '81268']);
assert.equal(q29.answer, 'b');
assert.equal(217 ** 2 + 183 ** 2, 80578);
assert.equal(q29.solutionPdfPage, 19);

const records = recalculateStreaks([
  { date: '2026-11-01', completed: true },
  { date: '2026-11-04', completed: true },
]);
assert.equal(records.find(r => r.date === '2026-11-01').streakValue, 1);
assert.equal(records.find(r => r.date === '2026-11-04').streakValue, 0);
assert.equal(currentStreak(records, '2026-11-04'), 0);
const resumed = recalculateStreaks([...records, { date: '2026-11-05', completed: true }]);
assert.equal(resumed.find(r => r.date === '2026-11-05').streakValue, 1);
console.log('Question-bank integrity and streak regression checks passed.');
