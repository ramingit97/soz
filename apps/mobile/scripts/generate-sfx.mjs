#!/usr/bin/env node
/**
 * Generates the app's sound effects as tiny 16-bit PCM mono WAV files.
 * No dependencies — hand-rolled RIFF header + synthesized samples.
 *
 * Run once (from apps/mobile): node scripts/generate-sfx.mjs
 * Outputs to assets/sfx/*.wav — commit the results.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 22050;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sfx');

/** Wrap Float32 samples (-1..1) into a 16-bit PCM mono WAV buffer. */
function toWav(samples) {
  const dataLen = samples.length * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

/** Render a list of tones into one sample buffer.
 * tone: { at, dur, freq, freqTo?, gain?, decay? }  (times in seconds)
 * decay: exponential envelope rate (higher = faster fade). Soft attack of 8ms baked in.
 */
function render(totalSec, tones) {
  const n = Math.ceil(totalSec * SAMPLE_RATE);
  const out = new Float32Array(n);
  for (const t of tones) {
    const start = Math.floor(t.at * SAMPLE_RATE);
    const len = Math.floor(t.dur * SAMPLE_RATE);
    const gain = t.gain ?? 0.5;
    const decay = t.decay ?? 6;
    const f0 = t.freq;
    const f1 = t.freqTo ?? t.freq;
    let phase = 0;
    for (let i = 0; i < len && start + i < n; i++) {
      const p = i / len; // 0..1 through the tone
      const freq = f0 + (f1 - f0) * p;
      phase += (2 * Math.PI * freq) / SAMPLE_RATE;
      const attack = Math.min(1, i / (0.008 * SAMPLE_RATE));
      const env = attack * Math.exp(-decay * p);
      // sine + a whisper of 2nd harmonic for warmth
      out[start + i] += (Math.sin(phase) + 0.18 * Math.sin(2 * phase)) * env * gain;
    }
  }
  return out;
}

// Note frequencies
const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, G6 = 1568.0;

const SOUNDS = {
  // Cheerful two-note rise
  'success.wav': render(0.35, [
    { at: 0, dur: 0.16, freq: C5, gain: 0.45, decay: 5 },
    { at: 0.11, dur: 0.24, freq: E5, gain: 0.5, decay: 5 },
  ]),
  // Soft, non-punishing descend
  'error.wav': render(0.3, [
    { at: 0, dur: 0.14, freq: 330, gain: 0.3, decay: 5 },
    { at: 0.12, dur: 0.18, freq: 277, gain: 0.28, decay: 5 },
  ]),
  // Tiny star-count blip
  'tick.wav': render(0.045, [{ at: 0, dur: 0.045, freq: G6, gain: 0.35, decay: 10 }]),
  // Lesson-complete arpeggio + closing chord
  'fanfare.wav': render(1.1, [
    { at: 0, dur: 0.18, freq: C5, gain: 0.42, decay: 5 },
    { at: 0.13, dur: 0.18, freq: E5, gain: 0.42, decay: 5 },
    { at: 0.26, dur: 0.18, freq: G5, gain: 0.42, decay: 5 },
    { at: 0.39, dur: 0.24, freq: C6, gain: 0.45, decay: 5 },
    // final triad
    { at: 0.6, dur: 0.5, freq: C5, gain: 0.3, decay: 4 },
    { at: 0.6, dur: 0.5, freq: E5, gain: 0.3, decay: 4 },
    { at: 0.6, dur: 0.5, freq: G5, gain: 0.3, decay: 4 },
  ]),
  // Playful pet-tap sweep
  'boop.wav': render(0.13, [{ at: 0, dur: 0.13, freq: 480, freqTo: 700, gain: 0.45, decay: 6 }]),
};

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, samples] of Object.entries(SOUNDS)) {
  const wav = toWav(samples);
  writeFileSync(join(OUT_DIR, name), wav);
  console.log(`${name}  ${(wav.length / 1024).toFixed(1)} KB`);
}
console.log(`\nDone → ${OUT_DIR}`);
