import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors, radius } from '@/theme';

/** Symmetric bar heights — tallest in the middle. */
const PHASES = [0.55, 0.75, 0.9, 1, 0.9, 0.75, 0.55];
const MAX_EXTRA = 26; // px added on top of the 5px resting bar

interface MicWaveformProps {
  /** Live mic level 0..1 (normalized dBFS). */
  level: SharedValue<number>;
  /** 1 = metering unavailable (Android quirk) → play a canned wave instead. */
  dead: SharedValue<number>;
}

function Bar({
  index,
  level,
  dead,
  wobble,
}: MicWaveformProps & { index: number; wobble: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    // Per-bar phase-shifted wobble so the bars feel organic, not synchronized
    const w = 0.5 + 0.5 * Math.sin(wobble.value * Math.PI * 2 + index * 1.1);
    const canned = 0.35 + 0.3 * w;
    const amp = dead.value >= 1 ? canned : level.value * (0.85 + w * 0.3);
    return { height: 5 + Math.min(1, amp) * MAX_EXTRA * (PHASES[index] ?? 1) };
  });
  return <Animated.View style={[styles.bar, style]} />;
}

/** Live voice-level bars shown while the child is recording. */
export function MicWaveform({ level, dead }: MicWaveformProps) {
  const wobble = useSharedValue(0);

  useEffect(() => {
    wobble.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false);
  }, [wobble]);

  return (
    <View style={styles.row} pointerEvents="none">
      {PHASES.map((_, i) => (
        <Bar key={i} index={i} level={level} dead={dead} wobble={wobble} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 34,
  },
  bar: {
    width: 5,
    borderRadius: radius.full,
    backgroundColor: colors.accentPink,
  },
});
