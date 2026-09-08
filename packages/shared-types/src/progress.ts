import type { LanguageCode, Level } from './language.js';

export interface LanguageProgress {
  language: LanguageCode;
  level: Level;
  currentDay: number;
  wordsLearned: string[];
  totalMinutes: number;
}

export interface ChildProgress {
  childId: string;
  english?: LanguageProgress;
  russian?: LanguageProgress;
  overallStreakDays: number;
  totalStars: number;
  lastActiveDate: string;
}
