function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v : undefined;
}

export const aiEnv = {
  get openaiKey() {
    return required('OPENAI_API_KEY');
  },
  get deepgramKey() {
    return required('DEEPGRAM_API_KEY');
  },
  get elevenlabsKey() {
    return optional('ELEVENLABS_API_KEY');
  },
  get elevenlabsVoiceEn() {
    return optional('ELEVENLABS_VOICE_ID_EN') ?? 'cgSgspJ2msm6clMCkdW9'; // Jessica — playful warm
  },
  get elevenlabsVoiceRu() {
    return optional('ELEVENLABS_VOICE_ID_RU') ?? 'cgSgspJ2msm6clMCkdW9'; // Jessica via multilingual
  },
  get elevenlabsModel() {
    return optional('ELEVENLABS_MODEL_ID') ?? 'eleven_flash_v2_5';
  },
};
