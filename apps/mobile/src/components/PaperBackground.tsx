/**
 * Honeybear background — warm cream surface used as the global canvas.
 *
 * Default: solid `colors.bg` with optional soft top/bottom warmth vignettes.
 * Variants offer the gentle gradients used on hero screens (paywall, onboarding).
 *
 * Kept as `PaperBackground` for callsite compatibility; renamed semantically
 * to "cream/honey" canvas.
 *
 * САМ ГРАДИЕНТ рисуется во весь экран, включая зону под системной панелью
 * навигации — так и должно быть. А вот СОДЕРЖИМОЕ обёрнуто в SafeAreaView по
 * нижнему краю, и это исправление конкретного дефекта: до 2026-09-11 ни один
 * файл приложения не использовал безопасные зоны, кроме Screen.tsx. В итоге все
 * 36 экранов на этом фоне рисовали нижние элементы ПОД панелью навигации — на
 * Galaxy A21s это 48 dp, и кнопка «Продолжить» на setup/profile-type была
 * обрезана наполовину.
 *
 * Только нижний край намеренно. Верх сейчас держат жёсткие `paddingTop` в самих
 * экранах (например 80 на profile-type); добавить сюда ещё и верхний инсет
 * означало бы сдвинуть содержимое вниз на всех 36 экранах и усугубить
 * переполнение. Привести верхние отступы к инсетам — работа этапа типографики.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useUIMode } from '@/hooks/useUIMode';
import { colors } from '@/theme';
import { MODE_TOKENS } from '@/theme/modeTokens';

type Variant = 'cream' | 'parchment' | 'honey' | 'sage' | 'night';

interface Props {
  variant?: Variant;
  children?: React.ReactNode;
  /**
   * Какие края уважать. По умолчанию только низ — там и была поломка.
   * Передать `[]`, если экрану нужен полноэкранный контент вплотную к краям.
   */
  edges?: readonly Edge[];
}

const GRADIENTS: Record<Variant, [string, string, string?]> = {
  // Honeybear Pro: subtle vertical cream wash instead of a flat fill
  cream: ['#FBF4E6', '#F6F0E2', '#F0E7D2'],
  parchment: [colors.bg, colors.bgDeep],
  honey: ['#FCE9CC', colors.bg],
  sage: ['#DDF1EA', colors.bg],
  night: ['#E0D6E8', colors.bg],
};

export function PaperBackground({ variant = 'cream', children, edges = ['bottom'] }: Props) {
  const { vignette } = MODE_TOKENS[useUIMode()];
  const g = GRADIENTS[variant];
  const grad: [string, string, ...string[]] = g[2] ? [g[0], g[1], g[2]] : [g[0], g[1]];
  return (
    <LinearGradient
      colors={grad}
      style={styles.root}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      {/* Subtle warm vignette at the top — только у малышей, старшим без неё */}
      {vignette ? <View style={styles.vignetteTop} pointerEvents="none" /> : null}
      <SafeAreaView style={styles.safe} edges={edges}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, position: 'relative' },
  safe: { flex: 1 },
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: 'rgba(245, 212, 102, 0.10)',
  },
});
