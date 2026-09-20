/**
 * HBChip — pill-shaped stat / metadata chip with soft inset look.
 *
 * Кремовый чип почти не виден на белой карточке (контраст 1.03), поэтому у него
 * всегда есть тонкая рамка.
 */

import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { fontFamily, fontSize, radius, shadow, spacing } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

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
  bg,
  color,
  big,
  style,
}: HBChipProps) {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  // Значения по умолчанию берутся здесь, а не в параметрах: они зависят от
  // возрастного режима, а параметры вычисляются один раз при загрузке модуля.
  const chipBg = bg ?? c.card;
  const chipInk = color ?? c.ink;
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: chipBg },
        big && styles.big,
        shadow.sm,
        style as ViewStyle,
      ]}
    >
      {leadingIcon ? <View style={styles.icon}>{leadingIcon}</View> : null}
      <Text style={[styles.text, { color: chipInk, fontSize: big ? fontSize.base : fontSize.sm }]}>
        {label}
      </Text>
      {trailingIcon ? <View style={styles.icon}>{trailingIcon}</View> : null}
    </View>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: t.c.surfaceBorder,
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
}));
