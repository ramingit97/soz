/**
 * HBIconBox — a soft tinted rounded square that holds an emoji/glyph or small
 * icon. Replaces the dozens of inline `{ width, height, borderRadius,
 * backgroundColor: '#FCE3CE' }` icon chips scattered across list rows and cards.
 */
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/Text';
import { radius, tints, type TintKey } from '@/theme';

interface Props {
  /** Emoji / short glyph to render. Omit and pass children for custom content. */
  glyph?: string;
  /** Named brand tint, or any color string. Defaults to peach. */
  tint?: TintKey | string;
  size?: number;
  /** Corner radius — defaults to lg (16). */
  rounding?: number;
  glyphSize?: number;
  style?: ViewStyle;
  children?: React.ReactNode;
}

export function HBIconBox({
  glyph,
  tint = 'primary',
  size = 44,
  rounding = radius.lg,
  glyphSize,
  style,
  children,
}: Props) {
  const bg = (tints as Record<string, string>)[tint] ?? tint;
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: rounding, backgroundColor: bg },
        style,
      ]}
    >
      {children ?? <Text style={{ fontSize: glyphSize ?? Math.round(size * 0.5) }}>{glyph}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
