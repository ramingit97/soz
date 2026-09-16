/**
 * Проиграть голосовой ответ персонажа и дождаться конца.
 *
 * Уроки «Покажи мир» и ролевая игра играли ответ из data-URI и ждали события
 * `didJustFinish` без ограничения по времени: если событие не приходило, экран
 * навсегда оставался в «говорит», и микрофон больше не нажимался. Здесь — как
 * в разговоре (`app/talk.tsx`): временный файл на телефоне, режим воспроизведения
 * через динамик, страховка 30 секунд и возврат режима записи в конце.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import type { MutableRefObject } from 'react';

import { playableAudioUri } from '@/utils/recording';

const MAX_WAIT_MS = 30_000;

export function stopReplyAudio(playerRef: MutableRefObject<AudioPlayer | null>): void {
  // pause() до remove(): одного remove бывает мало, голос продолжает звучать.
  try { playerRef.current?.pause(); } catch { /* уже освобождён */ }
  try { playerRef.current?.remove(); } catch { /* уже освобождён */ }
  playerRef.current = null;
}

export async function playReplyAudio(
  playerRef: MutableRefObject<AudioPlayer | null>,
  base64: string,
  mimeType: string,
  tag: string,
): Promise<void> {
  if (!base64) return;
  try {
    const { uri, cleanup } = await playableAudioUri(base64, mimeType, tag);
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    stopReplyAudio(playerRef);
    const player = createAudioPlayer({ uri });
    playerRef.current = player;
    player.play();
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { sub.remove(); resolve(); }, MAX_WAIT_MS);
      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) { clearTimeout(timer); sub.remove(); resolve(); }
      });
    });
    if (playerRef.current === player) stopReplyAudio(playerRef);
    cleanup();
  } catch (e) {
    console.warn('reply playback failed', e);
  } finally {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true }).catch(() => {});
  }
}
