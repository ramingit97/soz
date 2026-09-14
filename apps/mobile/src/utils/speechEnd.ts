/**
 * Когда ребёнок закончил говорить — чтобы не держать кнопку и не нажимать второй раз.
 *
 * Владелец, 2026-09-14: «сложно нажать на голос… он не может сам понять, когда я
 * перестал говорить». Запись теперь начинается нажатием и заканчивается сама:
 * детектор получает громкость микрофона (дБ) раз в ~100 мс и говорит «хватит».
 *
 * Правила простые, без ML:
 *  - первые CALIBRATE_MS — фоновый шум комнаты; порог речи = шум + SPEECH_MARGIN_DB;
 *  - речь началась, когда громче порога два замера подряд;
 *  - после начала речи тишина дольше `silenceMs` — конец;
 *  - речи так и не было `noSpeechMs` — конец (экран скажет «не расслышал»);
 *  - `maxMs` — жёсткий предел длины реплики.
 * Если громкость не приходит вовсе (метр недоступен), остаётся только `maxMs` и
 * повторное нажатие.
 *
 * Чистый модуль — проверяется `node --test`.
 */

export const CALIBRATE_MS = 300;
export const SPEECH_MARGIN_DB = 10;
/** Порог речи не ниже и не выше этих значений, как бы ни шумело при калибровке. */
export const MIN_THRESHOLD_DB = -55;
export const MAX_THRESHOLD_DB = -30;

export interface SpeechEndOptions {
  silenceMs?: number;
  noSpeechMs?: number;
  maxMs?: number;
}

export interface SpeechEndDetector {
  /** Очередной замер. `db` undefined — метр ничего не дал. true — пора остановить запись. */
  push: (elapsedMs: number, db: number | undefined) => boolean;
  /** Была ли уже распознана речь (для подсказок на экране). */
  heardSpeech: () => boolean;
}

export function createSpeechEndDetector(opts: SpeechEndOptions = {}): SpeechEndDetector {
  const silenceMs = opts.silenceMs ?? 1200;
  const noSpeechMs = opts.noSpeechMs ?? 7000;
  const maxMs = opts.maxMs ?? 15000;

  const calib: number[] = [];
  let threshold: number | null = null;
  let loudRun = 0;
  let speechStarted = false;
  let lastLoudAt = 0;

  return {
    heardSpeech: () => speechStarted,
    push(elapsedMs, db) {
      if (elapsedMs >= maxMs) return true;
      const valid = typeof db === 'number' && Number.isFinite(db);

      if (elapsedMs < CALIBRATE_MS) {
        if (valid) calib.push(db);
        return false;
      }
      if (threshold === null) {
        const floor = calib.length ? calib.reduce((a, b) => a + b, 0) / calib.length : -60;
        threshold = Math.min(MAX_THRESHOLD_DB, Math.max(MIN_THRESHOLD_DB, floor + SPEECH_MARGIN_DB));
      }
      if (!valid) return false;

      if (db > threshold) {
        loudRun += 1;
        lastLoudAt = elapsedMs;
        if (loudRun >= 2) speechStarted = true;
      } else {
        loudRun = 0;
      }

      if (speechStarted) return elapsedMs - lastLoudAt >= silenceMs;
      return elapsedMs >= noSpeechMs;
    },
  };
}

/** Громкость в дБ (≤ 0) → 0..1 для волны на экране. Голос ≈ −50…−8 дБ. */
export function levelFromDb(db: number): number {
  return Math.min(1, Math.max(0, (db + 50) / 42));
}
