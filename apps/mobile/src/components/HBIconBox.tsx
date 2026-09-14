/**
 * HBIconBox — a soft tinted rounded square that holds an icon. Replaces the
 * dozens of inline `{ width, height, borderRadius, backgroundColor: '#FCE3CE' }`
 * icon chips scattered across list rows and cards.
 *
 * `icon` — Lucide из закрытой карты, рисуется тёмным оттенком своей подложки.
 * `glyph` (эмодзи) остаётся, пока экраны не переведены на иконки.
 */
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Text } from '@/components/Text';
import { colors, radius, tints, type TintKey } from '@/theme';

/** Цвет иконки на каждой подложке — тот же оттенок, но тёмный. */
const TINT_INK: Record<TintKey, string> = {
  primary: colors.primaryDeep,
  sage: colors.accentDeep,
  butter: '#7F6628',
  berry: colors.berryDeep,
  english: '#3A6BAA',
};

interface Props {
  icon?: IconName;
  /** Цвет иконки; по умолчанию тёмный оттенок подложки. */
  iconColor?: string;
  /** @deprecated эмодзи — переводить на `icon`. */
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
  icon,
  iconColor,
  glyph,
  tint = 'primary',
  size = 44,
  rounding = radius.lg,
  glyphSize,
  style,
  children,
}: Props) {
  const bg = (tints as Record<string, string>)[tint] ?? tint;
  const ink = iconColor ?? (TINT_INK as Record<string, string>)[tint] ?? colors.ink;
  const inner = Math.round(size * 0.5);
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: rounding, backgroundColor: bg },
        style,
      ]}
    >
      {children ??
        (icon ? (
          <Icon name={icon} size={glyphSize ?? inner} color={ink} />
        ) : (
          <Text style={{ fontSize: glyphSize ?? inner }}>{glyph}</Text>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
