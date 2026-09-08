/**
 * HBCard — soft claymorphism surface card.
 *
 * Default look: cream-white card with warm drop shadow + subtle bottom rim
 * (the inset highlight that gives the design its "pillow" feel).
 */

import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { colors, radius, shadow, spacing } from '@/theme';

interface HBCardProps extends ViewProps {
  padded?: boolean;
  rim?: boolean;
  ringColor?: string;
  bg?: string;
  depth?: 'sm' | 'md' | 'deep' | 'none';
  style?: ViewStyle | ViewStyle[];
}

export function HBCard({
  children,
  padded = true,
  rim = true,
  ringColor,
  bg = colors.card,
  depth = 'md',
  style,
  ...rest
}: HBCardProps) {
  const depthStyle =
    depth === 'sm'
      ? shadow.sm
      : depth === 'md'
      ? shadow.md
      : depth === 'deep'
      ? shadow.deep
      : undefined;

  return (
    <View
      {...rest}
      style={[
        styles.card,
        { backgroundColor: bg },
        padded && styles.padded,
        rim && styles.rim,
        ringColor ? { borderColor: ringColor, borderWidth: 2.5 } : null,
        depthStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
  },
  padded: {
    padding: spacing[4],
  },
  // Honeybear Pro: single warm top highlight (light from above) — no bottom bevel
  rim: {
    borderTopWidth: 1.5,
    borderTopColor: colors.highlightWarm,
  },
});
