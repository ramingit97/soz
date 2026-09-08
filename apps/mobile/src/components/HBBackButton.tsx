/**
 * HBBackButton — the one back affordance for the whole app.
 *
 * Replaces ~15 hand-rolled variants (‹ / ← / ✕ at assorted sizes, some with a
 * shadow and some without). A 40×40 clay disc with a chevron, shadow.sm, and a
 * proper 44pt-ish tap target. Floats top-left by default; pass `inline` to drop
 * it into a header row.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/Text';
import { colors, radius, shadow, spacing } from '@/theme';

interface Props {
  /** Defaults to router.back(). */
  onPress?: () => void;
  /** Drop into a flex row instead of floating absolutely top-left. */
  inline?: boolean;
  /** Glyph — defaults to a chevron. */
  glyph?: string;
  /** Extra top offset for the floating variant (safe-area). Defaults to 50. */
  top?: number;
  style?: ViewStyle;
}

export function HBBackButton({ onPress, inline = false, glyph = '‹', top = 50, style }: Props) {
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
      accessibilityLabel="Back"
      style={({ pressed }) => [
        styles.btn,
        shadow.sm,
        !inline && { position: 'absolute', top, left: spacing[5], zIndex: 20 },
        pressed && styles.pressed,
        style,
      ]}
    >
      {/* Nudge the chevron optically centered */}
      <View style={glyph === '‹' ? styles.chevronNudge : undefined}>
        <Text style={styles.glyph}>{glyph}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1.5,
    borderTopColor: colors.highlightWarm,
  },
  pressed: { transform: [{ scale: 0.92 }], opacity: 0.9 },
  chevronNudge: { marginTop: -2, marginLeft: -2 },
  glyph: { fontFamily: 'Nunito_800ExtraBold', fontSize: 24, color: colors.ink },
});
