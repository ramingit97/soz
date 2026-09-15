/**
 * HBBackButton — the one back affordance for the whole app.
 *
 * Replaces ~15 hand-rolled variants (‹ / ← / ✕ at assorted sizes, some with a
 * shadow and some without). A 40×40 white disc with a Lucide chevron, shadow.sm,
 * and a proper 44pt-ish tap target. Floats top-left by default; pass `inline` to
 * drop it into a header row.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { colors, radius, shadow, spacing } from '@/theme';

interface Props {
  /** Defaults to router.back(). */
  onPress?: () => void;
  /** Drop into a flex row instead of floating absolutely top-left. */
  inline?: boolean;
  /** Defaults to a chevron; `x` for modal-like screens. */
  icon?: IconName;
  /** Extra top offset for the floating variant (safe-area). Defaults to 50. */
  top?: number;
  /** Подпись для экранного диктора, по умолчанию «Back». */
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export function HBBackButton({
  onPress,
  inline = false,
  icon = 'chevron-left',
  top = 50,
  accessibilityLabel = 'Back',
  style,
}: Props) {
  const router = useRouter();
  const handle = () => {
    Haptics.selectionAsync().catch(() => {});
    if (onPress) onPress();
    else router.back();
  };

  return (
    <Pressable
      onPress={handle}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.btn,
        shadow.sm,
        !inline && { position: 'absolute', top, left: spacing[5], zIndex: 20 },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Icon name={icon} size={22} color={colors.ink} strokeWidth={2.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: 0.92 }], opacity: 0.9 },
});
