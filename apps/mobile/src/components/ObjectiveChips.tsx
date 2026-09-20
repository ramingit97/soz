import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { fontFamily, fontSize, radius, spacing } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

interface ObjectiveChipsProps {
  labels: string[];
  done: boolean[];
}

function Chip({ label, isDone, onPress }: { label: string; isDone: boolean; onPress: () => void }) {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const accent = useAccent();
  const scale = useSharedValue(1);
  const wasDone = useRef(isDone);

  useEffect(() => {
    if (isDone && !wasDone.current) {
      // Just completed — pop!
      scale.value = withSequence(withSpring(1.15, { damping: 5, stiffness: 240 }), withSpring(1));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    wasDone.current = isDone;
  }, [isDone, scale]);

  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.chipWrap, aStyle]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ checked: isDone }}
        style={[styles.chip, isDone && { backgroundColor: accent.soft, borderColor: accent.bottom }]}
      >
        <Icon
          name={isDone ? 'circle-check' : 'circle'}
          size={14}
          color={isDone ? accent.ink : c.textMuted}
          strokeWidth={2.5}
        />
        <Text style={[styles.label, isDone && styles.labelDone]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/** Compact row of conversation micro-goals (topic checklist). Tap a chip to
 * peek its full text. Fixed-height container so the chat layout stays put. */
export function ObjectiveChips({ labels, done }: ObjectiveChipsProps) {
  const { mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const [peek, setPeek] = useState<number | null>(null);

  return (
    <View>
      <View style={styles.row}>
        {labels.map((label, i) => (
          <Chip
            key={i}
            label={label}
            isDone={done[i] ?? false}
            onPress={() => setPeek((p) => (p === i ? null : i))}
          />
        ))}
      </View>
      {peek !== null && labels[peek] ? (
        <Pressable onPress={() => setPeek(null)} style={styles.peek}>
          <Text style={styles.peekText}>{labels[peek]}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
  chipWrap: { flex: 1, minWidth: 0 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: t.c.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: t.c.surfaceBorder,
  },
  label: {
    flex: 1,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize['2xs'],
    color: t.c.inkSoft,
  },
  labelDone: { color: t.c.ink },
  peek: {
    backgroundColor: t.c.surface,
    borderWidth: 1,
    borderColor: t.c.surfaceBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginTop: 2,
  },
  peekText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: t.c.ink,
  },
}));
