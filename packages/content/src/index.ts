import type { Lesson, LanguageCode, Level } from '@soz/shared-types';

import enDay1Beginner from '../english/beginner/day-01.json' with { type: 'json' };
import ruDay1Beginner from '../russian/beginner/day-01.json' with { type: 'json' };

const ALL_LESSONS: Lesson[] = [enDay1Beginner as Lesson, ruDay1Beginner as Lesson];

export function getLesson(language: LanguageCode, level: Level, day: number): Lesson | null {
  return (
    ALL_LESSONS.find((l) => l.language === language && l.level === level && l.day === day) ?? null
  );
}

export function getAllLessonsForLanguage(language: LanguageCode): Lesson[] {
  return ALL_LESSONS.filter((l) => l.language === language);
}

export { ALL_LESSONS };
