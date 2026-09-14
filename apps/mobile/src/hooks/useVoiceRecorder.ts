/**
 * Запись реплики нажатием: start() — пишет, сама останавливается, когда ребёнок
 * замолчал (utils/speechEnd), stop() — отдаёт звук в base64 для API.
 *
 * Телефон: expo-audio с метром громкости (iOS — metering, Android — maxAmplitude).
 * Браузер: useVoiceRecorder.web.ts — Web Audio и WAV (у веб-рекордера expo-audio
 * нет метра, а его mp4 из Safari не принимал OpenAI). Интерфейс одинаковый.
 */
import { RecordingPresets, useAudioRecorder } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

import { createSpeechEndDetector, levelFromDb } from '@/utils/speechEnd';
import { readAsBase64, type EncodedMedia } from '@/utils/recording';

export interface VoiceStartOptions {
  /** Ребёнок замолчал, речи не было или вышло время — пора вызвать stop(). */
  onAutoStop: () => void;
  /** Громкость 0..1 для волны на экране. */
  onLevel?: (level: number) => void;
  /** Пауза, после которой реплика считается законченной. Для одного слова — короче. */
  silenceMs?: number;
}

export interface VoiceRecorder {
  start: (opts: VoiceStartOptions) => Promise<void>;
  /** Остановить запись; null — записывать было нечего. */
  stop: () => Promise<EncodedMedia | null>;
}

const POLL_MS = 100;

export function useVoiceRecorder(): VoiceRecorder {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);
  useEffect(() => clearTimer, [clearTimer]);

  const start = useCallback(
    async ({ onAutoStop, onLevel, silenceMs }: VoiceStartOptions) => {
      clearTimer();
      await recorder.prepareToRecordAsync();
      recorder.record();
      const detector = createSpeechEndDetector({ silenceMs });
      const startedAt = Date.now();
      timer.current = setInterval(() => {
        let db: number | undefined;
        try {
          db = recorder.getStatus().metering;
        } catch {
          db = undefined;
        }
        // dBFS ≤ 0; всё остальное — метр не работает.
        const valid = typeof db === 'number' && Number.isFinite(db) && db <= 0 ? db : undefined;
        if (valid !== undefined) onLevel?.(levelFromDb(valid));
        if (detector.push(Date.now() - startedAt, valid)) {
          clearTimer();
          onAutoStop();
        }
      }, POLL_MS);
    },
    [recorder, clearTimer],
  );

  const stop = useCallback(async (): Promise<EncodedMedia | null> => {
    clearTimer();
    await recorder.stop();
    const uri = recorder.uri;
    return uri ? readAsBase64(uri) : null;
  }, [recorder, clearTimer]);

  return { start, stop };
}
