/**
 * PCM из браузера → WAV 16 кГц моно для распознавания речи.
 *
 * Safari записывает MediaRecorder'ом в `audio/mp4`, и OpenAI отвечал на такие
 * файлы «Audio file might be corrupted or unsupported» — сервер ждал отказа и
 * распознавал заново через Deepgram, ответ Бобо приходил через 6–9 секунд. WAV
 * понимают и OpenAI, и Deepgram. 16 кГц моно — стандарт для речи: 5 секунд
 * реплики ≈ 160 КБ.
 *
 * Чистый модуль — проверяется `node --test`.
 */

export const SPEECH_SAMPLE_RATE = 16000;

/** Склеить куски и понизить частоту (усреднением по окну — без алиасинга «в лоб»). */
export function downsample(chunks: Float32Array[], fromRate: number, toRate = SPEECH_SAMPLE_RATE): Float32Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  if (fromRate === toRate) return merged;

  const ratio = fromRate / toRate;
  const outLength = Math.floor(total / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(total, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += merged[j]!;
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

/** Float32 [-1, 1] → WAV (RIFF, PCM 16 бит, моно). */
export function encodeWav(samples: Float32Array, sampleRate = SPEECH_SAMPLE_RATE): Uint8Array {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeAscii = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // размер блока fmt
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // моно
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // байт в секунду
  view.setUint16(32, bytesPerSample, true); // выравнивание блока
  view.setUint16(34, 16, true); // бит на отсчёт
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * bytesPerSample, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

/** Байты → base64 кусками, чтобы не упереться в лимит аргументов String.fromCharCode. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
