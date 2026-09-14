/**
 * Записанный звук (или выбранное фото) → base64 для API, на телефоне и в браузере.
 *
 * На телефоне запись лежит файлом, и её читает expo-file-system. В браузере файла
 * нет: рекордер отдаёт `blob:`-адрес, а `FileSystem.readAsStringAsync` бросает.
 * Экраны ловили эту ошибку и молча возвращались в ожидание — в веб-превью
 * казалось, что Бобо «не слышит» (владелец, 2026-09-14, iPhone Safari).
 *
 * Формат тоже разный: телефон пишет m4a, Safari — `audio/mp4` (тот же контейнер),
 * Chrome — `audio/webm`. Серверу его нужно передать, иначе распознавание гадает.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export interface EncodedMedia {
  base64: string;
  /** Без параметров кодека: `audio/webm`, а не `audio/webm;codecs=opus`. */
  mimeType: string;
}

export async function readAsBase64(uri: string, nativeMimeType = 'audio/m4a'): Promise<EncodedMedia> {
  if (Platform.OS !== 'web') {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return { base64, mimeType: nativeMimeType };
  }
  const blob = await (await fetch(uri)).blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read_failed'));
    reader.readAsDataURL(blob);
  });
  return {
    base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
    mimeType: (blob.type || nativeMimeType).split(';')[0]!.trim(),
  };
}

/**
 * base64 от сервера (голос Бобо, песня) → адрес, который понимает плеер.
 *
 * На телефоне — временный файл: data-URI ненадёжны у createAudioPlayer на iOS.
 * В браузере файловой системы нет, а data-URI плеер понимает — иначе голос Бобо
 * в веб-превью молчал. `cleanup` удаляет временный файл (на вебе ничего не делает).
 */
export async function playableAudioUri(
  base64: string,
  mimeType: string,
  prefix: string,
): Promise<{ uri: string; cleanup: () => void }> {
  if (Platform.OS === 'web') {
    return { uri: `data:${mimeType};base64,${base64}`, cleanup: () => {} };
  }
  const ext = mimeType.includes('mp3') || mimeType.includes('mpeg') ? 'mp3' : mimeType.includes('wav') ? 'wav' : 'm4a';
  const uri = `${FileSystem.cacheDirectory ?? ''}${prefix}-${Date.now()}.${ext}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return { uri, cleanup: () => { FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}); } };
}
