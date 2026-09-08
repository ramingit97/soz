/**
 * App accent = the pet's color. The child picks Хани's color once (setup/pet),
 * and that same hue becomes the app's accent — so primary buttons (and, over
 * time, other accent surfaces) wear "your color". Base cream/ink/claymorphism
 * never changes; only the accent family shifts.
 *
 * Keyed to the SAME hues HBPet uses, so pet and app always match. Hue 55 (honey)
 * maps to the existing brand peach, so the default look is unchanged — only a
 * child who deliberately recolors the pet sees a themed app.
 */
import { colors } from './colors';

export interface Accent {
  /** Gradient top (slightly lighter) for pillowy buttons. */
  top: string;
  /** Gradient bottom / solid accent. */
  bottom: string;
  /** Readable label color on the accent (dark on light-yellow, else white). */
  text: string;
  /** Soft tint fill (chips, halos, progress track echoes). */
  soft: string;
}

const ACCENTS: Record<number, Accent> = {
  55: { top: '#EC9C64', bottom: colors.primary, text: '#FFFFFF', soft: colors.primarySoft }, // honey → brand peach (default)
  175: { top: '#86D0BE', bottom: colors.accent, text: '#FFFFFF', soft: '#D4F2EA' }, // sage
  90: { top: '#F7D972', bottom: colors.butter, text: colors.ink, soft: '#FFF6D0' }, // butter (dark text!)
  25: { top: '#F4A583', bottom: '#F0936F', text: '#FFFFFF', soft: '#FCD3C0' }, // coral
  230: { top: '#96BEEC', bottom: '#84B0E6', text: '#FFFFFF', soft: '#CFE2F7' }, // sky
  300: { top: '#CFA2D1', bottom: '#C593C8', text: '#FFFFFF', soft: '#E8D2EA' }, // orchid
  350: { top: '#F09BB2', bottom: '#ED8AA6', text: '#FFFFFF', soft: '#FAD3DD' }, // rose
};

/** Pure: nearest accent for any hue (mirrors HBPet's nearest-preset logic). */
export function accentFor(hue: number): Accent {
  const hues = Object.keys(ACCENTS).map(Number);
  const closest = hues.reduce((a, b) => (Math.abs(b - hue) < Math.abs(a - hue) ? b : a));
  return ACCENTS[closest]!;
}
