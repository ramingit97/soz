/**
 * HBChip — pill-shaped stat / metadata chip with soft inset look.
 */

import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

interface HBChipProps {
  label: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  bg?: string;
  color?: string;
  style?: ViewStyle | ViewStyle[];
  big?: boolean;
}

export function HBChip({
  label,
  leadingIcon,
  trailingIcon,
  bg = colors.card,
  color = colors.ink,
  big,
  style,
}: HBChipProps) {
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: bg },
        big && styles.big,
        shadow.sm,
        style as ViewStyle,
      ]}
    >
      {leadingIcon ? <View style={styles.icon}>{leadingIcon}</View> : null}
      <Text style={[styles.text, { color, fontSize: big ? fontSize.base : fontSize.sm }]}>
        {label}
      </Text>
      {trailingIcon ? <View style={styles.icon}>{trailingIcon}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  big: {
    paddingHorizontal: spacing[4],
    paddingVertical: 8,
  },
  text: {
    fontFamily: fontFamily.bodyBold,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
