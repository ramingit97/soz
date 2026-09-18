/**
 * Уровни языка — общие для экрана уровня (`setup/level`) и мини-проверки
 * (`setup/placement`). Коды CEFR — ориентир для родителя, не экзамен.
 */

import type { ChildLevel } from '@/store/settings';

export const LEVEL_ORDER: ChildLevel[] = ['beginner', 'elementary', 'pre_intermediate', 'intermediate'];

export const LEVEL_INFO: Record<ChildLevel, { code: string; ru: string; az: string; descRu: string; descAz: string }> = {
  beginner: {
    code: 'A1',
    ru: 'Начинающий',
    az: 'Yeni başlayan',
    descRu: 'Почти не знает — начнём с нуля',
    descAz: 'Demək olar heç bilmir — sıfırdan',
  },
  elementary: {
    code: 'A2',
    ru: 'Элементарный',
    az: 'Elementar',
    descRu: 'Знает слова и простые фразы',
    descAz: 'Sözlər və sadə ifadələr tanıyır',
  },
  pre_intermediate: {
    code: 'B1',
    ru: 'Средний',
    az: 'Orta',
    descRu: 'Может вести простой разговор',
    descAz: 'Sadə mövzularda söhbət apara bilir',
  },
  intermediate: {
    code: 'B2',
    ru: 'Уверенный',
    az: 'Sərbəst',
    descRu: 'Свободно говорит, обсуждает темы',
    descAz: 'Sərbəst danışır, mövzuları müzakirə edir',
  },
};
