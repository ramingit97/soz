/**
 * Браузерная версия useVoiceRecorder: микрофон через Web Audio, WAV 16 кГц.
 *
 * Зачем своя: у веб-рекордера expo-audio нет метра громкости (без него запись не
 * остановится сама), а его mp4 из Safari OpenAI отвергал — ответ Бобо шёл через
 * повторное распознавание 6–9 секунд. Интерфейс — как у useVoiceRecorder.ts.
 */
import { useCallback, useEffect, useRef } from 'react';

import type { VoiceRecorder, VoiceStartOptions } from './useVoiceRecorder';
import type { EncodedMedia } from '@/utils/recording';
import { createSpeechEndDetector, levelFromDb } from '@/utils/speechEnd';
import { bytesToBase64, downsample, encodeWav } from '@/utils/wav';

interface Session {
  ctx: AudioContext;
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  chunks: Float32Array[];
}

export function useVoiceRecorder(): VoiceRecorder {
  const session = useRef<Session | null>(null);

  const release = useCallback(async (s: Session) => {
    s.processor.onaudioprocess = null;
    try { s.source.disconnect(); } catch { /* already */ }
    try { s.processor.disconnect(); } catch { /* already */ }
    s.stream.getTracks().forEach((t) => t.stop());
    await s.ctx.close().catch(() => {});
  }, []);

  useEffect(() => () => {
    if (session.current) void release(session.current);
    session.current = null;
  }, [release]);

  const start = useCallback(
    async ({ onAutoStop, onLevel, silenceMs }: VoiceStartOptions) => {
      if (session.current) {
        await release(session.current);
        session.current = null;
      }
      // AudioContext создаём и будим ДО первого await: iOS Safari разрешает звук
      // только внутри жеста пользователя, а после await жест уже «истёк».
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const resumed = ctx.resume();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      await resumed;

      const source = ctx.createMediaStreamSource(stream);
      // ScriptProcessor устарел, но работает везде, включая Safari, и не требует
      // отдельного файла модуля, как AudioWorklet.
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      const detector = createSpeechEndDetector({ silenceMs });
      const startedAt = performance.now();
      let autoStopped = false;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(input));
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i]! * input[i]!;
        const db = 20 * Math.log10(Math.max(Math.sqrt(sum / input.length), 1e-8));
        onLevel?.(levelFromDb(db));
        if (!autoStopped && detector.push(performance.now() - startedAt, db)) {
          autoStopped = true;
          onAutoStop();
        }
      };
      source.connect(processor);
      // Процессор срабатывает, только если подключён к выходу; сам он пишет тишину.
      processor.connect(ctx.destination);
      session.current = { ctx, stream, source, processor, chunks };
    },
    [release],
  );

  const stop = useCallback(async (): Promise<EncodedMedia | null> => {
    const s = session.current;
    session.current = null;
    if (!s) return null;
    const sampleRate = s.ctx.sampleRate;
    await release(s);
    if (s.chunks.length === 0) return null;
    const wav = encodeWav(downsample(s.chunks, sampleRate));
    return { base64: bytesToBase64(wav), mimeType: 'audio/wav' };
  }, [release]);

  return { start, stop };
}
