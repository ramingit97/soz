import OpenAI from 'openai';

import type { LanguageCode } from '@soz/shared-types';

import { aiEnv } from './env.js';

export interface TTSResult {
  audioBase64: string;
  mimeType: string;
  durationMs: number;
  /** True when no TTS provider was usable (no key, free tier, or API error). */
  stubbed: boolean;
  /** Which provider produced the audio, or why it failed. */
  reason?: string;
}

let openaiCached: OpenAI | null = null;
function openai(): OpenAI {
  if (!openaiCached) openaiCached = new OpenAI({ apiKey: aiEnv.openaiKey });
  return openaiCached;
}

/**
 * Try ElevenLabs first (best voice quality for a mascot), fall back to
 * OpenAI TTS-1 with the warm "nova" voice. Returns stubbed only if BOTH fail.
 */
export async function synthesizeBobo(args: {
  text: string;
  language: LanguageCode;
}): Promise<TTSResult> {
  const start = Date.now();
  const elevenKey = aiEnv.elevenlabsKey;

  // ── Try ElevenLabs first if configured ──────────────────────────────────
  if (elevenKey) {
    const voiceId = args.language === 'en' ? aiEnv.elevenlabsVoiceEn : aiEnv.elevenlabsVoiceRu;
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': elevenKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text: args.text,
            model_id: aiEnv.elevenlabsModel,
            voice_settings: {
              stability: 0.55,
              similarity_boost: 0.75,
              style: 0.4,
              use_speaker_boost: true,
            },
          }),
        },
      );

      if (response.ok) {
        const buf = Buffer.from(await response.arrayBuffer());
        return {
          audioBase64: buf.toString('base64'),
          mimeType: 'audio/mpeg',
          durationMs: Date.now() - start,
          stubbed: false,
          reason: 'elevenlabs',
        };
      }

      const body = await response.text();
      console.warn(`[tts] ElevenLabs ${response.status}: ${body.slice(0, 200)} — falling back to OpenAI`);
    } catch (err) {
      console.warn('[tts] ElevenLabs threw — falling back to OpenAI:', err);
    }
  }

  // ── Fall back to OpenAI TTS ─────────────────────────────────────────────
  try {
    const speech = await openai().audio.speech.create({
      model: 'tts-1',
      voice: 'nova', // Warm, playful — good fit for a kids' mascot
      input: args.text,
      speed: 0.95,
    });
    const buf = Buffer.from(await speech.arrayBuffer());
    return {
      audioBase64: buf.toString('base64'),
      mimeType: 'audio/mpeg',
      durationMs: Date.now() - start,
      stubbed: false,
      reason: 'openai',
    };
  } catch (err) {
    console.warn('[tts] OpenAI TTS threw:', err);
    return {
      audioBase64: '',
      mimeType: 'audio/mpeg',
      durationMs: Date.now() - start,
      stubbed: true,
      reason: 'all_providers_failed',
    };
  }
}
