/**
 * Цвета питомца. Ребёнок выбирает один из семи оттенков в `pet-room`, и тот же
 * оттенок становится акцентом приложения (`./accent.ts` ключуется этими же
 * числами — `PetHue`, иначе персонаж и кнопки разъехались бы по цвету).
 *
 * Числа — исторические «градусы» из прототипа на oklch; в сторе лежит число,
 * поэтому ключи не переименовываются.
 */
export const PET_HUES = [55, 25, 90, 175, 230, 300, 350] as const;
export type PetHue = (typeof PET_HUES)[number];

export interface PetPalette {
  /** Блик на выпуклом — верх градиента. */
  light: string;
  /** Основной цвет шерсти или корпуса. */
  body: string;
  /** Тень градиента, уши робота, лапы. */
  deep: string;
  /** Щёки медвежонка и «румянец» на экране робота. */
  cheek: string;
  /** Светлая морда, внутренность ушей и живот медвежонка. */
  muzzle: string;
  /** Свечение глаз и рта на тёмном экране робота. */
  glow: string;
}

const PALETTES: Record<PetHue, PetPalette> = {
  // мёд — по умолчанию
  55: { light: '#FBD9B5', body: '#E8A877', deep: '#B47B47', cheek: '#E08A6A', muzzle: '#FFF0DC', glow: '#FFE2B8' },
  // коралл
  25: { light: '#FCD3C0', body: '#F0936F', deep: '#C25C3C', cheek: '#D9694A', muzzle: '#FFEDE4', glow: '#FFD2BF' },
  // масло
  90: { light: '#F2E5B0', body: '#D6BC6A', deep: '#9C8138', cheek: '#D9A04A', muzzle: '#FBF4D8', glow: '#FFF0A8' },
  // шалфей
  175: { light: '#C9EADF', body: '#7DC6B5', deep: '#469684', cheek: '#E8A08E', muzzle: '#EAF7F2', glow: '#BFF5E6' },
  // небо
  230: { light: '#CFE2F7', body: '#84B0E6', deep: '#5180BC', cheek: '#E89AAE', muzzle: '#EEF5FC', glow: '#CBE6FF' },
  // орхидея
  300: { light: '#E8D2EA', body: '#C593C8', deep: '#8C5C90', cheek: '#C97090', muzzle: '#F7ECF8', glow: '#F3D2F6' },
  // роза
  350: { light: '#FAD3DD', body: '#ED8AA6', deep: '#C25876', cheek: '#D9607F', muzzle: '#FDEEF2', glow: '#FFD0DD' },
};

/** Ближайший из семи оттенков: в сторе может лежать любое число. */
export function nearestPetHue(hue: number): PetHue {
  return PET_HUES.reduce((a, b) => (Math.abs(b - hue) < Math.abs(a - hue) ? b : a));
}

export function petPaletteFor(hue: number): PetPalette {
  return PALETTES[nearestPetHue(hue)];
}

/** Названия цветов для выбора в `pet-room` (карточка знакомства). */
export const PET_COLOR_NAMES: Record<PetHue, { ru: string; az: string }> = {
  55: { ru: 'Медовый', az: 'Bal' },
  25: { ru: 'Коралл', az: 'Mərcan' },
  90: { ru: 'Лимонный', az: 'Limon' },
  175: { ru: 'Мятный', az: 'Nanə' },
  230: { ru: 'Небесный', az: 'Göy' },
  300: { ru: 'Сливовый', az: 'Gavalı' },
  350: { ru: 'Розовый', az: 'Çəhrayı' },
};
