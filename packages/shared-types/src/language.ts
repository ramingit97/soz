export const LANGUAGE_CODES = ['en', 'ru'] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export const LEVELS = ['beginner', 'elementary', 'pre_intermediate', 'intermediate'] as const;
export type Level = (typeof LEVELS)[number];

export const PARENT_UI_LANGUAGES = ['az', 'ru'] as const;
export type ParentUILanguage = (typeof PARENT_UI_LANGUAGES)[number];

export const NATIVE_LANGUAGES = ['az', 'ru', 'both'] as const;
export type NativeLanguage = (typeof NATIVE_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<LanguageCode, { en: string; ru: string; az: string; flag: string }> = {
  en: { en: 'English', ru: 'Английский', az: 'İngilis dili', flag: '🇬🇧' },
  ru: { en: 'Russian', ru: 'Русский', az: 'Rus dili', flag: '🇷🇺' },
};
