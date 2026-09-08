export const fontFamily = {
  display: 'Fredoka_700Bold',
  displaySemi: 'Fredoka_600SemiBold',
  body: 'Nunito_400Regular',
  bodyMedium: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyBlack: 'Nunito_800ExtraBold',
} as const;

export const fontSize = {
  // Micro sizes below xs — name the values already used raw across the app
  // (uppercase labels, captions, pill text) so hierarchy is intentional, not
  // magic numbers. Same pixels as before → naming is a zero-visual-change.
  '3xs': 10,
  '2xs': 11,
  caption: 13, // small labels / hints that sit between xs and sm
  button: 17, // the historic hand-rolled CTA size
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
} as const;

export const lineHeight = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.4,
  relaxed: 1.6,
} as const;
