import { createClient, type DeepgramClient } from '@deepgram/sdk';
import OpenAI, { toFile } from 'openai';

import type { LanguageCode } from '@soz/shared-types';

import { aiEnv } from './env.js';

let cached: DeepgramClient | null = null;

function client(): DeepgramClient {
  if (!cached) cached = createClient(aiEnv.deepgramKey);
  return cached;
}

let cachedOpenai: OpenAI | null = null;

function openai(): OpenAI {
  if (!cachedOpenai) cachedOpenai = new OpenAI({ apiKey: aiEnv.openaiKey });
  return cachedOpenai;
}

export interface TranscribeResult {
  transcript: string;
  durationMs: number;
  /** Deepgram confidence score 0..1 (overall). Lower = unclear pronunciation. */
  confidence: number;
  /** Per-word confidence scores — useful for spotting which word was unclear. */
  words: { word: string; confidence: number }[];
}

export interface TranscribeOpts {
  /**
   * Learner's L1 for code-switched speech ("i am a web developer, but рынок
   * сейчас сдох"). Enables understanding native-language words dropped into
   * target-language speech. Omit for strict single-language transcription
   * (word-check and friends must stay strict).
   *
   * 'ru' → hybrid: Deepgram (per-word confidences for pronunciation hints) and
   *        OpenAI STT race in parallel; Cyrillic in the OpenAI transcript means
   *        the learner really mixed Russian in, so that transcript wins.
   *        (Deepgram nova-3 'multi' was tested and does NOT catch short Russian
   *        fragments inside an English sentence — it stays locked on English.)
   * 'az' → OpenAI STT only: Deepgram has no Azerbaijani support at all.
   */
  codeSwitch?: 'ru' | 'az' | null;
}

const DEEPGRAM_LANG: Record<LanguageCode, string> = {
  en: 'en',
  ru: 'ru',
};

/**
 * Transcribe a single audio buffer with Deepgram Nova-3.
 * For Phase 2 prototype we use the prerecorded API — simple and fast enough
 * (~200-500ms for short clips). Streaming will be added when optimizing latency.
 */
export async function transcribe(
  audio: Buffer,
  language: LanguageCode,
  mimeType = 'audio/m4a',
  opts: TranscribeOpts = {},
): Promise<TranscribeResult> {
  // Code-switch (conversation) turns: ALWAYS OpenAI — it hears both the target
  // language and the learner's L1. The earlier Deepgram-vs-OpenAI hybrid kept
  // losing to confident Deepgram garble on real-device Russian speech
  // (founder decision 2026-07-04: "пусть всегда пытается понять OpenAI").
  // Deepgram stays for strict single-language calls (word-check etc.).
  if (opts.codeSwitch) {
    const oaRes = await transcribeOpenAI(
      audio,
      language,
      mimeType,
      opts.codeSwitch === 'az' ? 'Azerbaijani' : 'Russian',
    );
    console.log('[stt] openai(codeSwitch) =', JSON.stringify(oaRes.transcript));
    if (oaRes.transcript) return oaRes;
    // OpenAI came back empty (silence, hiccup) — one Deepgram attempt beats
    // telling the child "I didn't hear that" when audio was actually fine.
    return transcribeDeepgram(audio, language, mimeType);
  }

  return transcribeDeepgram(audio, language, mimeType);
}

async function transcribeDeepgram(
  audio: Buffer,
  language: LanguageCode,
  mimeType: string,
): Promise<TranscribeResult> {
  const start = Date.now();
  const dg = client();

  const { result, error } = await dg.listen.prerecorded.transcribeFile(audio, {
    model: 'nova-3',
    language: DEEPGRAM_LANG[language],
    smart_format: true,
    punctuate: true,
    mimetype: mimeType,
  });

  if (error) {
    const msg =
      typeof error === 'object' && error !== null
        ? (error as { message?: string }).message ?? JSON.stringify(error)
        : String(error);
    console.warn('[stt] Deepgram error:', msg);
    return { transcript: '', durationMs: Date.now() - start, confidence: 0, words: [] };
  }

  const alt = result?.results?.channels[0]?.alternatives[0];
  const transcript = alt?.transcript?.trim() ?? '';
  const confidence = alt?.confidence ?? 0;
  const words = (alt?.words ?? []).map((w: { word: string; confidence: number }) => ({
    word: w.word,
    confidence: w.confidence,
  }));

  return { transcript, durationMs: Date.now() - start, confidence, words };
}

/**
 * OpenAI STT (gpt-4o-mini-transcribe: verified to transcribe mixed ru-in-en
 * speech verbatim, ~4x faster than gpt-4o-transcribe and cheaper). No per-word
 * confidence, so we report a perfect score — the pronunciation-hint gate simply
 * never fires on this path.
 */
async function transcribeOpenAI(
  audio: Buffer,
  language: LanguageCode,
  mimeType: string,
  nativeName: string,
): Promise<TranscribeResult> {
  const start = Date.now();
  const targetName = language === 'en' ? 'English' : 'Russian';
  try {
    const ext = mimeType.includes('mp3') || mimeType.includes('mpeg') ? 'mp3'
      : mimeType.includes('wav') ? 'wav'
      : 'm4a';
    const res = await openai().audio.transcriptions.create({
      model: 'gpt-4o-mini-transcribe',
      file: await toFile(audio, `speech.${ext}`, { type: mimeType }),
      // Steers the model toward the actual situation: a learner speaking the
      // target language who may drop native-language words mid-sentence.
      prompt: `A language learner speaking ${targetName}, sometimes mixing in ${nativeName} words or phrases. Transcribe exactly what is said, keeping each language in its own script.`,
    });
    return {
      transcript: res.text?.trim() ?? '',
      durationMs: Date.now() - start,
      confidence: 1,
      words: [],
    };
  } catch (e) {
    console.warn('[stt] OpenAI transcription error:', (e as Error).message);
    return { transcript: '', durationMs: Date.now() - start, confidence: 0, words: [] };
  }
}
