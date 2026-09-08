/**
 * Honeybear background — warm cream surface used as the global canvas.
 *
 * Default: solid `colors.bg` with optional soft top/bottom warmth vignettes.
 * Variants offer the gentle gradients used on hero screens (paywall, onboarding).
 *
 * Kept as `PaperBackground` for callsite compatibility; renamed semantically
 * to "cream/honey" canvas.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

type Variant = 'cream' | 'parchment' | 'honey' | 'sage' | 'night';

interface Props {
  variant?: Variant;
  children?: React.ReactNode;
}

const GRADIENTS: Record<Variant, [string, string, string?]> = {
  // Honeybear Pro: subtle vertical cream wash instead of a flat fill
  cream: ['#FBF4E6', '#F6F0E2', '#F0E7D2'],
  parchment: [colors.bg, colors.bgDeep],
  honey: ['#FCE9CC', colors.bg],
  sage: ['#DDF1EA', colors.bg],
  night: ['#E0D6E8', colors.bg],
};

export function PaperBackground({ variant = 'cream', children }: Props) {
  const g = GRADIENTS[variant];
  const grad: [string, string, ...string[]] = g[2] ? [g[0], g[1], g[2]] : [g[0], g[1]];
  return (
    <LinearGradient
      colors={grad}
      style={styles.root}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      {/* Subtle warm vignette at the top */}
      <View style={styles.vignetteTop} pointerEvents="none" />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, position: 'relative' },
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: 'rgba(245, 212, 102, 0.10)',
  },
});
