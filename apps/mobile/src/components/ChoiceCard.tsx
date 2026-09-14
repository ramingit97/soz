/**
 * ChoiceCard — один вариант ответа в вопросе с единственным выбором.
 *
 * Иконка (или короткая метка вроде «EN»), заголовок, пояснение, кружок выбора
 * справа. Выбранный вариант обведён акцентом. `compact` — для сетки 2×2, без
 * иконки и кружка: там выбор и так виден по рамке.
 */
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { HBCard } from './HBCard';
import { HBIconBox } from './HBIconBox';
import { type IconName } from './Icon';
import { Text } from './Text';
import { useAccent } from '@/hooks/useAccent';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

interface Props {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Короткая метка вместо иконки: «EN», «RU». */
  mark?: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ChoiceCard({ title, subtitle, icon, mark, selected, onPress, compact, style }: Props) {
  const accent = useAccent();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={style}
    >
      <HBCard
        depth={selected ? 'md' : 'sm'}
        ringColor={selected ? accent.bottom : undefined}
        style={[styles.card, compact && styles.cardCompact, !selected && styles.unselectedPad]}
      >
        {!compact && (icon || mark) ? (
          <HBIconBox
            icon={icon}
            tint={selected ? accent.soft : colors.bg}
            iconColor={selected ? accent.ink : colors.inkSoft}
            size={44}
          >
            {mark ? <Text style={[styles.mark, { color: selected ? accent.ink : colors.inkSoft }]}>{mark}</Text> : undefined}
          </HBIconBox>
        ) : null}
        <View style={styles.text}>
          <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
          {subtitle ? (
            <Text variant="caption" tone="secondary" style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {!compact ? (
          <View style={[styles.radio, selected && { borderColor: accent.bottom, backgroundColor: accent.bottom }]}>
            {selected ? <View style={[styles.radioDot, { backgroundColor: accent.text }]} /> : null}
          </View>
        ) : null}
      </HBCard>
    </Pressable>
  );
}

// Рамка выбранной карточки 2.5 px против 1 px у обычной — без поправки текст
// прыгал бы на полтора пикселя при выборе.
const RING_DELTA = 1.5;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  unselectedPad: { margin: RING_DELTA },
  cardCompact: { flexDirection: 'column', alignItems: 'flex-start', gap: 0, minHeight: 76 },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.lg, color: colors.ink },
  titleCompact: { fontSize: fontSize.xl },
  subtitle: { marginTop: 2 },
  mark: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.sm },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
});
