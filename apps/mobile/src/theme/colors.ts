/**
 * Honeybear · Soft Claymorphism palette
 * Converted from oklch design tokens to hex (React Native doesn't support oklch).
 */
export const colors = {
  // Honeybear base — warm cream surfaces
  bg: '#F6F0E2', // oklch(96.5% 0.018 75)
  bgDeep: '#EAE0CB', // oklch(93% 0.025 70)
  card: '#FFFBF1', // Honeybear Pro — whiter, separates from bg without heavy shadow
  paper: '#F6F0E2', // alias for compat
  paperShadow: '#EAE0CB',
  cream: '#FFF6EC',
  parchment: '#FFEFD9',
  white: '#FFFFFF',
  midnight: '#1A1330',
  // Warm "light from above" highlight (top rim on cards/buttons)
  highlightWarm: 'rgba(255, 247, 233, 0.55)',

  // Ink — readable on cream
  ink: '#3C3121', // oklch(28% 0.04 60)
  inkSoft: '#6B5C46', // Honeybear Pro — darker for WCAG contrast on cream
  inkOnPaper: '#3C3121',

  // Honeybear brand — warm peach/orange + sage
  primary: '#E8945A', // oklch(72% 0.16 50)
  primaryDeep: '#C97339', // oklch(62% 0.18 45)
  primarySoft: '#FCE3CE', // tinted card variant
  accent: '#7AC9B5', // oklch(74% 0.13 175) — sage
  accentDeep: '#4FA08D',
  butter: '#F5D466', // oklch(86% 0.14 95)
  butterDeep: '#D4B040',
  berry: '#E55C73', // oklch(68% 0.18 5)
  berryDeep: '#B73E55',

  // Legacy Bobo aliases (still referenced by older code paths)
  bobo: '#E8945A',
  boboDark: '#C97339',
  boboLight: '#F5C19D',
  boboSoft: '#FCE3CE',

  // Accents reused across the app
  accentPink: '#E55C73',
  accentYellow: '#F5D466',
  accentMint: '#7AC9B5',
  accentCoral: '#E8945A',

  // Language zones — kept for bilingual chips
  english: '#4A8AFF',
  englishLight: '#DCE9FF',
  russian: '#E8945A',
  russianLight: '#FCE3CE',

  // Text hierarchy
  textPrimary: '#3C3121',
  textSecondary: '#6B5C46',
  textMuted: '#B5A993',
  textOnDark: '#FFF6EC',

  // System
  border: '#EAE0CB',
  borderStrong: '#D7CBB0',
  success: '#7AC9B5',
  error: '#E55C73',
  warning: '#F5D466',

  // Overlays
  overlay: 'rgba(60, 49, 33, 0.55)',
  shimmer: 'rgba(255, 255, 255, 0.6)',
} as const;

export type ColorKey = keyof typeof colors;
