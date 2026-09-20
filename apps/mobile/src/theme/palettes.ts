/**
 * Палитры возрастных режимов — из макетов `context/mockups/` (выбор владельца
 * 2026-09-20).
 *
 *  - `kid` — вариант C «волшебный остров»: лавандовые листы, фиолетовый акцент,
 *    зелёная кнопка-леденец, золото наград, закатное небо на сценах.
 *  - `teen` — вариант D: тёмно-синий фон, спокойные карточки, мятный акцент,
 *    жёлтая кнопка. Тот же набор ключей, другие значения.
 *
 * Ключи намеренно повторяют прежний статический `colors` (`ink`, `surface`,
 * `bgDeep`, `primary`…), чтобы перевод 700 обращений в 67 экранах был чисто
 * механическим: `colors.ink` → `t.c.ink`, без переосмысления каждого места.
 * Новые роли макетов (`cta`, `accentSoft`, `gold`, `glass`, градиенты сцен)
 * добавлены рядом — на них экраны переходят по мере переписывания в этапах 3–9.
 *
 * Экран не должен знать, какой сейчас режим: он берёт `t.c.ink`, а режим
 * подставляет своё значение. Модуль без React Native — его проверяет `node --test`.
 */

export interface Palette {
  // ── Поверхности ───────────────────────────────────────────────────────────
  bg: string;
  bgDeep: string;
  card: string;
  surface: string;
  surfaceBorder: string;
  paper: string;
  paperShadow: string;
  cream: string;
  parchment: string;
  white: string;
  midnight: string;
  /** Светлая грань сверху у кнопок и карточек. */
  highlightWarm: string;
  /** Полупрозрачное «стекло» поверх сцены: пилюли на небе, чипы в разговоре. */
  glass: string;
  glassBorder: string;

  // ── Текст ─────────────────────────────────────────────────────────────────
  ink: string;
  inkSoft: string;
  inkOnPaper: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnDark: string;

  // ── Акцент режима ─────────────────────────────────────────────────────────
  /** Главный акцент: у детей фиолетовый, у взрослых мятный. */
  primary: string;
  primaryDeep: string;
  primarySoft: string;
  /** Второй акцент: у детей аква, у взрослых тот же мятный. */
  accent: string;
  accentDeep: string;
  /** Мягкая заливка акцента: чип, halo, дорожка прогресса. */
  accentSoft: string;
  /** Акцент как цвет текста на `surface` и на `accentSoft`. */
  accentInk: string;

  // ── Главное действие ──────────────────────────────────────────────────────
  /** Кнопка: верх градиента (kid — зелёный леденец, teen — жёлтая). */
  cta: string;
  /** Кнопка: низ градиента. */
  ctaBottom: string;
  /** Нижняя грань кнопки — объём. */
  ctaEdge: string;
  /** Подпись на кнопке. */
  ctaText: string;

  // ── Роли ──────────────────────────────────────────────────────────────────
  success: string;
  successDeep: string;
  successSoft: string;
  error: string;
  errorSoft: string;
  warning: string;
  warningSoft: string;
  /** Золото наград: звёзды, серия, сундук. */
  gold: string;
  goldDeep: string;
  goldSoft: string;

  // ── Прежние семантические имена (уходят в этапе 10) ───────────────────────
  butter: string;
  butterDeep: string;
  berry: string;
  berryDeep: string;
  /** Цвет самого персонажа: медвежонок медовый, робот светло-синий. */
  bobo: string;
  boboDark: string;
  boboLight: string;
  boboSoft: string;
  accentPink: string;
  accentYellow: string;
  accentMint: string;
  accentCoral: string;
  /** Языковые зоны: чипы курса, снежинка заморозки серии. */
  english: string;
  englishLight: string;
  russian: string;
  russianLight: string;

  // ── Разделители, тени, наложения ──────────────────────────────────────────
  border: string;
  borderStrong: string;
  shadowColor: string;
  overlay: string;
  shimmer: string;

  // ── Мягкие заливки (подложки иконок, чипы, тонированные карточки) ─────────
  tints: { primary: string; sage: string; butter: string; berry: string; english: string };
  /** Состояния для родительских экранов: цвет текста и его подложка. */
  semantic: {
    gold: string; goldSoft: string;
    warn: string; warnSoft: string;
    danger: string; dangerSoft: string;
  };

  // ── Сцены (градиенты сверху вниз) ─────────────────────────────────────────
  /** Главный экран: закатное небо у детей, ровный тёмный у взрослых. */
  skyGradient: readonly [string, string, ...string[]];
  /** Урок. */
  lessonGradient: readonly [string, string, ...string[]];
  /** Разговор. */
  nightGradient: readonly [string, string, ...string[]];
  /** Праздник в конце урока. */
  partyGradient: readonly [string, string, ...string[]];
  /** Трава острова. */
  grass: string;
  grassDeep: string;
}

/** Вариант C: дети 5–10. */
const KID: Palette = {
  bg: '#F6F1FF',
  bgDeep: '#E9E1FF',
  card: '#F3EEFF',
  surface: '#FFFFFF',
  surfaceBorder: '#E3D9FA',
  paper: '#F6F1FF',
  paperShadow: '#DCD2FA',
  cream: '#FBF7FF',
  parchment: '#F3EEFF',
  white: '#FFFFFF',
  midnight: '#1B1452',
  highlightWarm: 'rgba(255, 255, 255, 0.55)',
  glass: 'rgba(255, 255, 255, 0.24)',
  glassBorder: 'rgba(255, 255, 255, 0.55)',

  ink: '#2A1E5C',
  inkSoft: '#6A5F9A',
  inkOnPaper: '#2A1E5C',
  textPrimary: '#2A1E5C',
  textSecondary: '#6A5F9A',
  textMuted: '#A59CCB',
  textOnDark: '#FFFFFF',

  primary: '#6C4DF2',
  primaryDeep: '#4B30C9',
  primarySoft: '#EDE7FF',
  accent: '#38D6E8',
  accentDeep: '#1A9FB8',
  accentSoft: '#EDE7FF',
  accentInk: '#5637D6',

  cta: '#8BEA5C',
  ctaBottom: '#36C759',
  ctaEdge: '#1F9A43',
  ctaText: '#FFFFFF',

  success: '#36C759',
  successDeep: '#1F9A43',
  successSoft: '#DFF6DC',
  error: '#FF4F6D',
  errorSoft: '#FFE1E7',
  warning: '#FF9F5A',
  warningSoft: '#FFEBDB',
  gold: '#FFC83A',
  goldDeep: '#E59A00',
  goldSoft: '#FFF3C2',

  butter: '#FFC83A',
  butterDeep: '#E59A00',
  berry: '#FF4F6D',
  berryDeep: '#C22B5A',
  bobo: '#E9A35C',
  boboDark: '#C47634',
  boboLight: '#F6BB78',
  boboSoft: '#FCE6C8',
  accentPink: '#FF6FA5',
  accentYellow: '#FFC83A',
  accentMint: '#38D6E8',
  accentCoral: '#FF9F5A',
  english: '#4A6BFF',
  englishLight: '#E2E6FF',
  russian: '#FF6FA5',
  russianLight: '#FFE2EE',

  border: '#E3D9FA',
  borderStrong: '#CDBDF5',
  shadowColor: '#2A1E5C',
  overlay: 'rgba(30, 20, 70, 0.55)',
  shimmer: 'rgba(255, 255, 255, 0.6)',

  tints: {
    primary: '#EDE7FF',
    sage: '#D9F7F3',
    butter: '#FFF3C2',
    berry: '#FFE1E7',
    english: '#E2E6FF',
  },
  semantic: {
    gold: '#E59A00', goldSoft: '#FFF3C2',
    warn: '#C2570E', warnSoft: '#FFEBDB',
    danger: '#C22B5A', dangerSoft: '#FFE1E7',
  },

  skyGradient: ['#3B2FB5', '#7A5CF0', '#FF8FB0', '#FFC58F', '#FFE9BF'],
  lessonGradient: ['#E9E1FF', '#FBF4FF'],
  nightGradient: ['#1B1452', '#3D2A9E', '#8459E6', '#C48BF0'],
  partyGradient: ['#4B30C9', '#8C5BE8', '#FF8FB0', '#FFC58F'],
  grass: '#8BEA5C',
  grassDeep: '#279B55',
};

/** Вариант D: 11+, взрослые и вся родительская зона. */
const TEEN: Palette = {
  bg: '#121A3A',
  bgDeep: '#0D1430',
  card: '#2A3870',
  surface: '#1C2752',
  surfaceBorder: '#2A3870',
  paper: '#121A3A',
  paperShadow: '#05081A',
  cream: '#1C2752',
  parchment: '#2A3870',
  white: '#FFFFFF',
  midnight: '#05081A',
  highlightWarm: 'rgba(255, 255, 255, 0.18)',
  glass: 'rgba(255, 255, 255, 0.10)',
  glassBorder: 'rgba(255, 255, 255, 0.22)',

  ink: '#FFFFFF',
  inkSoft: '#DCE2FA',
  inkOnPaper: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#DCE2FA',
  textMuted: '#8F9BCB',
  textOnDark: '#FFFFFF',

  primary: '#3DE0D0',
  primaryDeep: '#19B8AA',
  primarySoft: 'rgba(61, 224, 208, 0.14)',
  accent: '#3DE0D0',
  accentDeep: '#19B8AA',
  accentSoft: 'rgba(61, 224, 208, 0.14)',
  accentInk: '#3DE0D0',

  cta: '#FFD469',
  ctaBottom: '#FFC93C',
  ctaEdge: '#DB9B00',
  ctaText: '#121A3A',

  success: '#3DE0D0',
  successDeep: '#19B8AA',
  successSoft: 'rgba(61, 224, 208, 0.14)',
  error: '#FF6B7A',
  errorSoft: 'rgba(255, 107, 122, 0.14)',
  warning: '#FFB84D',
  warningSoft: 'rgba(255, 184, 77, 0.12)',
  gold: '#FFC93C',
  goldDeep: '#DB9B00',
  goldSoft: 'rgba(255, 201, 60, 0.16)',

  butter: '#FFC93C',
  butterDeep: '#DB9B00',
  berry: '#FF6B7A',
  berryDeep: '#E0505F',
  bobo: '#C9D5FF',
  boboDark: '#8F9BCB',
  boboLight: '#E4EAFF',
  boboSoft: '#2A3870',
  accentPink: '#FF8FB0',
  accentYellow: '#FFC93C',
  accentMint: '#3DE0D0',
  accentCoral: '#FFB84D',
  english: '#7FA8FF',
  englishLight: 'rgba(127, 168, 255, 0.16)',
  russian: '#FF8FB0',
  russianLight: 'rgba(255, 143, 176, 0.16)',

  border: '#2A3870',
  borderStrong: '#3A4A8C',
  shadowColor: '#05081A',
  overlay: 'rgba(5, 8, 26, 0.7)',
  shimmer: 'rgba(255, 255, 255, 0.18)',

  tints: {
    primary: 'rgba(61, 224, 208, 0.14)',
    sage: 'rgba(61, 224, 208, 0.14)',
    butter: 'rgba(255, 201, 60, 0.16)',
    berry: 'rgba(255, 107, 122, 0.14)',
    english: 'rgba(127, 168, 255, 0.16)',
  },
  semantic: {
    gold: '#FFC93C', goldSoft: 'rgba(255, 201, 60, 0.16)',
    warn: '#FFB84D', warnSoft: 'rgba(255, 184, 77, 0.12)',
    danger: '#FF6B7A', dangerSoft: 'rgba(255, 107, 122, 0.14)',
  },

  skyGradient: ['#121A3A', '#121A3A'],
  lessonGradient: ['#121A3A', '#121A3A'],
  nightGradient: ['#0D1430', '#121A3A'],
  partyGradient: ['#121A3A', '#1C2752'],
  grass: '#2A3870',
  grassDeep: '#1C2752',
};

/** Ключ мягкой заливки — подложки иконок, чипы, тонированные карточки. */
export type TintKey = keyof Palette['tints'];

export const PALETTES = { kid: KID, teen: TEEN } as const;
