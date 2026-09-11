import { Dimensions } from 'react-native';

export const fontFamily = {
  display: 'Fredoka_700Bold',
  displaySemi: 'Fredoka_600SemiBold',
  body: 'Nunito_400Regular',
  bodyMedium: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyBlack: 'Nunito_800ExtraBold',
} as const;

/**
 * Адаптивная шкала кегля.
 *
 * Базой взяты 375 dp — столько у iPhone 12 mini и у типичного Android. Дешёвые
 * 720p-телефоны дают 320 dp: на них заголовок в 36 px оставлял 8–9 символов в
 * строке, «Ваш ребёнок учит два языка в игре» разваливалось на четыре рваные
 * строки со словом «учит» в одиночестве, и из-за высоты заголовка содержимому
 * не хватало места — герой вылезал за контейнер и накрывал кнопку.
 *
 * Ширину читаем ОДИН РАЗ при загрузке модуля. Это осознанно и безопасно:
 * приложение заблокировано в портрете (`orientation: 'portrait'` в
 * app.config.ts), поворота не будет. Сделать иначе нельзя — 718 мест в коде
 * вызывают `StyleSheet.create()` на уровне модуля, а он замораживает значения;
 * компонент `Text` с вариантами покрывает всего 26 мест из 744, так что чинить
 * там было бы бессмысленно.
 *
 * Два разных коэффициента, и это главное:
 *
 *  - `display` — для крупных размеров (2xl и выше). Им есть куда ужиматься,
 *    и именно они ломают вёрстку. На 320 dp заголовок становится 31 px вместо
 *    36 — это примерно на 14% больше символов в строке.
 *  - `text` — для читаемых размеров (xl и ниже). Почти не двигается: детский
 *    интерфейс нельзя мельчить, 12 px должны остаться 12 px. Диапазон узкий
 *    намеренно — он компенсирует только крайности.
 *
 * Верхние границы обрезаны, чтобы на планшете текст не раздувался.
 */
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const BASE_WIDTH = 375;
const width = Dimensions.get('window').width;

/** Крупные размеры ужимаются заметно: они и виноваты в переполнении. */
const display = clamp(width / BASE_WIDTH, 0.84, 1.08);
/** Читаемые размеры почти не двигаются: разборчивость важнее плотности. */
const text = clamp(width / BASE_WIDTH, 0.94, 1.04);

const scaleText = (px: number) => Math.round(px * text);
const scaleDisplay = (px: number) => Math.round(px * display);

export const fontSize = {
  // Micro sizes below xs — name the values already used raw across the app
  // (uppercase labels, captions, pill text) so hierarchy is intentional, not
  // magic numbers.
  '3xs': scaleText(10),
  '2xs': scaleText(11),
  caption: scaleText(13), // small labels / hints that sit between xs and sm
  button: scaleText(17), // the historic hand-rolled CTA size
  xs: scaleText(12),
  sm: scaleText(14),
  base: scaleText(16),
  lg: scaleText(18),
  xl: scaleText(20),
  '2xl': scaleDisplay(24),
  '3xl': scaleDisplay(30),
  '4xl': scaleDisplay(36),
  '5xl': scaleDisplay(48),
  '6xl': scaleDisplay(60),
} as const;

export const lineHeight = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.4,
  relaxed: 1.6,
} as const;

/**
 * Для сырых размеров, которых ещё нет в шкале, и для вычисляемых на месте.
 * Использовать вместо числа в новом коде, если подходящего токена нет:
 * `fontSize: scaleFont(22)`. Порог 22 и выше считается крупным.
 */
export function scaleFont(px: number): number {
  return px >= 22 ? scaleDisplay(px) : scaleText(px);
}
