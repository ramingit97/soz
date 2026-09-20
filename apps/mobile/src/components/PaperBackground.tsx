/**
 * Honeybear background — warm cream surface used as the global canvas.
 *
 * По умолчанию — фон страницы режима с мягкой виньеткой сверху у малышей.
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

import { MODE_TOKENS, byMode, makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

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

/**
 * Фоны сцен из палитры режима (макеты C и D):
 *  - `cream` — обычная страница: лавандовый лист у детей, ровный тёмный у взрослых;
 *  - `honey` — герой-экраны (приветствие, пейволл): закатное небо;
 *  - `night` — разговор;
 *  - `sage`, `parchment` — спокойные варианты для второстепенных экранов.
 */
const GRADIENTS_BY_MODE = byMode<Record<Variant, readonly [string, string, ...string[]]>>((t) => ({
  cream: [t.c.cream, t.c.bg, t.c.bgDeep],
  parchment: [t.c.bg, t.c.bgDeep],
  honey: t.c.skyGradient,
  sage: [t.c.accentSoft, t.c.bg],
  night: t.c.nightGradient,
}));

export function PaperBackground({ variant = 'cream', children, edges = ['bottom'] }: Props) {
  const { mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const { vignette } = MODE_TOKENS[uiMode];
  const grad = GRADIENTS_BY_MODE[uiMode][variant];
  return (
    <LinearGradient
      colors={grad}
      style={styles.root}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      {/* Тёплая виньетка сверху — только у малышей. Плавный градиент, а не
          плоский блок: у блока был жёсткий нижний край на 180 dp, он резал
          пузыри чата и карточки, и казалось, что интерфейс уезжает под полосу. */}
      {vignette ? (
        <LinearGradient
          colors={['rgba(245, 212, 102, 0.14)', 'rgba(245, 212, 102, 0)']}
          style={styles.vignetteTop}
          pointerEvents="none"
        />
      ) : null}
      <SafeAreaView style={styles.safe} edges={edges}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  root: { flex: 1, position: 'relative' },
  safe: { flex: 1 },
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
}));
