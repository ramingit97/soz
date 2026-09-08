import type { LanguageCode } from './language.js';

export interface TalkRequest {
  childId: string;
  conversationId: string;
  lessonId: string;
  language: LanguageCode;
  audioBase64: string;
}

export interface TalkResponse {
  transcript: string;
  responseText: string;
  audioUrl: string;
  newWords: string[];
  usedTargetPhrases: string[];
  cost: {
    sttMs: number;
    llmMs: number;
    ttsMs: number;
    totalUsd: number;
  };
}
