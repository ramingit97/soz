/**
 * Автоостановка записи должна срабатывать после речи и паузы — и не обрывать
 * ребёнка, который ещё говорит, и не ждать вечно, если он молчит.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { createSpeechEndDetector, levelFromDb } = await import('./speechEnd.js');
const { downsample, encodeWav, bytesToBase64 } = await import('./wav.js');

/** Прогнать дорожку громкости с шагом 100 мс; вернуть момент остановки или null. */
function run(levels: (number | undefined)[], opts?: Parameters<typeof createSpeechEndDetector>[0]) {
  const d = createSpeechEndDetector(opts);
  for (let i = 0; i < levels.length; i++) {
    const t = i * 100;
    if (d.push(t, levels[i])) return { stopAt: t, heard: d.heardSpeech() };
  }
  return { stopAt: null, heard: d.heardSpeech() };
}

const quiet = (n: number) => Array(n).fill(-55);
const speech = (n: number) => Array(n).fill(-20);

describe('createSpeechEndDetector', () => {
  it('речь, потом пауза — остановка через ~1.2 с тишины', () => {
    const r = run([...quiet(5), ...speech(15), ...quiet(20)]);
    assert.equal(r.heard, true);
    // последняя громкая отметка — 1900 мс, тишина 1200 мс → 3100
    assert.equal(r.stopAt, 3100);
  });

  it('короткие паузы между словами не обрывают реплику', () => {
    const r = run([...quiet(5), ...speech(5), ...quiet(6), ...speech(5), ...quiet(15)]);
    assert.equal(r.heard, true);
    assert.equal(r.stopAt, 2000 + 1200);
  });

  it('молчание — остановка по noSpeechMs, речь не засчитана', () => {
    const r = run(quiet(100));
    assert.equal(r.heard, false);
    assert.equal(r.stopAt, 7000);
  });

  it('один щелчок не считается речью', () => {
    const r = run([...quiet(5), -15, ...quiet(100)]);
    assert.equal(r.heard, false);
  });

  it('шумная комната поднимает порог: гул не принимается за речь', () => {
    const r = run([...Array(5).fill(-40), ...Array(60).fill(-38), ...Array(5).fill(-15), ...Array(20).fill(-38)]);
    assert.equal(r.heard, true);
    assert.equal(r.stopAt, 6900 + 1200);
  });

  it('метр недоступен — только предел длины', () => {
    const r = run(Array(200).fill(undefined));
    assert.equal(r.stopAt, 15000);
  });

  it('длинная реплика обрывается на maxMs', () => {
    const r = run([...quiet(5), ...speech(300)], { maxMs: 12000 });
    assert.equal(r.stopAt, 12000);
  });
});

describe('levelFromDb', () => {
  it('тишина — 0, громкий голос — 1', () => {
    assert.equal(levelFromDb(-60), 0);
    assert.equal(levelFromDb(0), 1);
  });
});

describe('WAV', () => {
  it('заголовок PCM 16 бит моно 16 кГц и правильный размер', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 0.5]));
    const view = new DataView(wav.buffer);
    const ascii = (a: number, n: number) => String.fromCharCode(...wav.subarray(a, a + n));
    assert.equal(ascii(0, 4), 'RIFF');
    assert.equal(ascii(8, 4), 'WAVE');
    assert.equal(view.getUint16(22, true), 1, 'моно');
    assert.equal(view.getUint32(24, true), 16000);
    assert.equal(view.getUint16(34, true), 16);
    assert.equal(view.getUint32(40, true), 8, '4 отсчёта × 2 байта');
    assert.equal(wav.length, 52);
    assert.equal(view.getInt16(46, true), 0x7fff);
    assert.equal(view.getInt16(48, true), -0x8000);
  });

  it('понижение 48 → 16 кГц втрое укорачивает и усредняет', () => {
    const out = downsample([new Float32Array([0.3, 0.3, 0.3]), new Float32Array([0.6, 0.6, 0.6])], 48000, 16000);
    assert.equal(out.length, 2);
    assert.ok(Math.abs(out[0]! - 0.3) < 1e-6);
    assert.ok(Math.abs(out[1]! - 0.6) < 1e-6);
  });

  it('base64 совпадает с Buffer', () => {
    const bytes = new Uint8Array(70000).map((_, i) => i % 256);
    assert.equal(bytesToBase64(bytes), Buffer.from(bytes).toString('base64'));
  });
});
