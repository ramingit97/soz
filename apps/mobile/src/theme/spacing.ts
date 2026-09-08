export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  32: 128,
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
