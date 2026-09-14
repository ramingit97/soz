import { Dimensions } from 'react-native';

/**
 * Адаптивная шкала отступов — та же логика и та же база (375 dp), что у кегля в
 * ./typography.ts, читать вместе с ней.
 *
 * Зачем: на 320 dp `spacing[6]` (24) с каждой стороны — это 48 dp, 15% всей
 * ширины экрана. Внутри карточки к ним добавляются свои отступы, и тексту
 * остаётся около 150 dp: «Настраивает родитель · игра и безопасность»
 * разваливалось на две строки с осиротевшей точкой на конце первой. Выравнивание
 * тут не виновато — текст и так по левому краю, ему просто не хватало места.
 *
 * Второй, не менее важный эффект — по вертикали. Те же отступы и промежутки
 * съедают высоту, а её на коротком экране и не хватало: на экране возраста
 * четыре карточки с промежутками выигрывают несколько десятков dp, и четвёртая
 * перестаёт быть недосягаемой.
 *
 * Диапазон узкий (0.88–1.06) намеренно. Отступы держат ритм всего интерфейса, и
 * ужимать их сильно — значит получить тесноту вместо компактности. Ноль и
 * двухпиксельный шаг не масштабируются: округление всё равно вернуло бы их к
 * себе, а 0 должен остаться ровно нулём.
 *
 * Ширина читается один раз при загрузке модуля — приложение заблокировано в
 * портрете, а `StyleSheet.create()` на уровне модуля всё равно заморозил бы
 * любое динамическое значение.
 */
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const k = clamp(Dimensions.get('window').width / 375, 0.88, 1.06);
const sp = (px: number) => (px <= 2 ? px : Math.round(px * k));

export const spacing = {
  0: 0,
  0.5: sp(2),
  1: sp(4),
  1.5: sp(6),
  2: sp(8),
  3: sp(12),
  4: sp(16),
  5: sp(20),
  6: sp(24),
  7: sp(28),
  8: sp(32),
  10: sp(40),
  12: sp(48),
  14: sp(56),
  16: sp(64),
  20: sp(80),
  24: sp(96),
  32: sp(128),
} as const;

// Radius scale with role contrast (Honeybear Pro): inputs/tracks md, cards/chips lg,
// interactive xl, large cards 2xl, one hero block per screen 3xl. Less uniform = more
// modern hierarchy than the old everything-at-22 look.
export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20, // was 22 — interactive
  '2xl': 26, // was 28 — large cards
  '3xl': 36, // hero block
  full: 9999,
} as const;

/**
 * Honeybear Pro shadows — three honest depth levels (instead of one heavy pillow):
 * - sm   contact shadow (sits low + crisp)
 * - md   raised surface (cards, buttons)
 * - lg   lifted card
 * - deep floating — reserve for ONE hero/CTA per screen
 * - glow reserved for premium/celebration moments
 * Overall opacity pulled down to ~0.12–0.16 so surfaces look sculpted, not muddy.
 */
export const shadow = {
  // Обычная карточка: белая поверхность и рамка уже отделяют её от фона, тени
  // остаётся только намекнуть на подъём.
  card: {
    shadowColor: '#5A3F1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  sm: {
    shadowColor: '#5A3F1C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#5A3F1C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  lg: {
    shadowColor: '#5A3F1C',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 10,
  },
  deep: {
    shadowColor: '#5A3F1C',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 26,
    elevation: 14,
  },
  glow: {
    shadowColor: '#E8945A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

/**
 * Tonal contact-shadow colors — a surface casts a shadow in its own hue rather than
 * a universal brown umber. A key "2026" cue. Use as `shadowColor`.
 */
export const shadowTint = {
  ink: '#5A3F1C',
  primary: '#C97339',
  sage: '#3C8674',
  berry: '#B73E55',
  butter: '#8F7430',
} as const;
