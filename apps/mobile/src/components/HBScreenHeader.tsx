/**
 * HBScreenHeader — consistent top bar for secondary screens: an inline back
 * button, a title (+ optional subtitle), and an optional right-side slot. Gives
 * every non-tab screen the same header rhythm instead of bespoke layouts.
 */
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { HBBackButton } from '@/components/HBBackButton';
import { Text } from '@/components/Text';
import { spacing } from '@/theme';

interface Props {
  title?: string;
  subtitle?: string;
  /** Hide the back button (e.g. a root screen). */
  hideBack?: boolean;
  onBack?: () => void;
  /** Element pinned to the right (action button, counter chip…). */
  right?: React.ReactNode;
  style?: ViewStyle;
}

export function HBScreenHeader({ title, subtitle, hideBack, onBack, right, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.side}>{!hideBack && <HBBackButton inline onPress={onBack} />}</View>
      <View style={styles.center}>
        {title ? (
          <Text variant="headline" align="center" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="caption" tone="secondary" align="center" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const SIDE = 44;
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    gap: spacing[2],
    minHeight: SIDE,
  },
  side: { width: SIDE, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center', gap: 2 },
});
