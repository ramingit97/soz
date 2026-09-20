import assert from 'node:assert/strict';
import { test } from 'node:test';

const { weekStrip } = await import('./weekStrip.js');

// Среда 2026-09-16; понедельник этой недели — 2026-09-14.
const WED = '2026-09-16';

test('серия из трёх дней закрывает пн–ср, дальше будущее', () => {
  const w = weekStrip(3, WED, WED);
  assert.deepEqual(w.map((d) => d.state), ['done', 'done', 'done', 'future', 'future', 'future', 'future']);
  assert.equal(w[0]!.date, '2026-09-14');
});

test('урока сегодня ещё не было — сегодняшний день «today», вчерашние закрыты', () => {
  const w = weekStrip(2, '2026-09-15', WED);
  assert.deepEqual(w.map((d) => d.state), ['done', 'done', 'today', 'future', 'future', 'future', 'future']);
});

test('серия оборвалась — прошлые дни недели не красятся', () => {
  // Последний урок в пятницу прошлой недели: серия уже мертва.
  const w = weekStrip(5, '2026-09-11', WED);
  assert.deepEqual(w.map((d) => d.state), ['missed', 'missed', 'today', 'future', 'future', 'future', 'future']);
});

test('серии нет вовсе', () => {
  const w = weekStrip(0, null, WED);
  assert.deepEqual(w.map((d) => d.state), ['missed', 'missed', 'today', 'future', 'future', 'future', 'future']);
});

test('воскресенье считается последним днём недели', () => {
  const w = weekStrip(1, '2026-09-20', '2026-09-20');
  assert.equal(w[6]!.date, '2026-09-20');
  assert.equal(w[6]!.state, 'done');
});

test('азербайджанские подписи', () => {
  assert.equal(weekStrip(0, null, WED, true)[0]!.label, 'B.e');
});
