/**
 * Honeybear decor tokens — the values screens kept re-inventing inline
 * (gradients, soft tint fills, clay rim borders). Centralized so the look stays
 * coherent and can be tuned in one place. Hex values match what was already on
 * screen, so adopting these is a no-visual-change refactor.
 */
import { colors } from './colors';

/** LinearGradient `colors` arrays. */
export const gradients = {
  primary: [colors.primary, colors.primaryDeep] as [string, string],
  accent: [colors.accent, colors.accentDeep] as [string, string],
  butter: [colors.butter, colors.butterDeep] as [string, string],
  berry: [colors.berry, colors.berryDeep] as [string, string],
  // Calm screen washes
  cream: [colors.cream, colors.parchment] as [string, string],
  night: ['#1A1330', '#2D1F5C', '#3D2A7A'] as [string, string, string],
} as const;

/** Soft tint fills for icon boxes, chips, and tinted card variants. */
export const tints = {
  primary: colors.primarySoft, // peach  #FCE3CE
  sage: '#D4F2EA',
  butter: '#FFF6D0',
  berry: '#FDDDE4',
  english: colors.englishLight, // #DCE9FF
} as const;

export type TintKey = keyof typeof tints;

/**
 * Scene tints — the alternating soft fills for multi-scene screens (story, read).
 * These replace the ad-hoc arrays that had crept in an off-palette lavender
 * (#EAE6FF/#6B54E0). All five are drawn from the sanctioned palette, so scenes
 * still alternate for variety but stay unmistakably Honeybear (the cool slot is
 * the English language light, our one deliberate cool accent — not a stray purple).
 */
export const sceneTints = [
  colors.primarySoft, // peach   #FCE3CE
  tints.butter, // butter  #FFF6D0
  tints.sage, // sage    #D4F2EA
  tints.berry, // berry   #FDDDE4
  colors.englishLight, // sky     #DCE9FF
] as const;

/** Matching accent/ring colors for each scene tint (same order). */
export const sceneRings = [
  colors.primary,
  colors.butterDeep,
  colors.accentDeep,
  colors.berry,
  colors.english,
] as const;

/**
 * Semantic state pairs (soft background + deep text/icon), all palette-derived.
 * Replaces the scattered bespoke gold/amber/red hexes across parent screens.
 */
export const semantic = {
  gold: colors.butterDeep, // #D4B040 — text/icon on goldSoft
  goldSoft: tints.butter, // #FFF6D0
  warn: colors.primaryDeep, // #C97339 — warm orange text
  warnSoft: colors.primarySoft, // #FCE3CE
  danger: colors.berryDeep, // #B73E55
  dangerSoft: tints.berry, // #FDDDE4
} as const;

/** Claymorphism rim: warm highlight on the top edge, soft shadow on the bottom —
 * the "light from above" cue. Apply as borderTopColor / borderBottomColor with a
 * 1.5px border. */
export const clay = {
  rimLight: colors.highlightWarm, // top
  rimShadow: 'rgba(90, 63, 28, 0.10)', // bottom
} as const;
