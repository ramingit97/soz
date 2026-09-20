/**
 * Skeleton — animated placeholder blocks that hint at the shape of content
 * being loaded. Shimmer effect uses a moving gradient over a base block.
 */

import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radius } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius: br = radius.md, style }: SkeletonProps) {
  const { c } = useTheme();
  const shimmerX = useSharedValue(-1);

  useEffect(() => {
    shimmerX.value = withRepeat(
      withTiming(1, { duration: 1400 }),
      -1,
      false,
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value * 200 }],
  }));

  return (
    <View
      style={[
        { width: width as number | `${number}%`, height, borderRadius: br, backgroundColor: c.paperShadow, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFillObject, shimmerStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
}

/** Pre-composed skeleton for a content card with title + 3 lines of body */
export function CardSkeleton({ height = 140 }: { height?: number }) {
  const { mode: uiMode } = useTheme();
  const skelStyles = skelStylesByMode[uiMode];
  return (
    <View style={[skelStyles.card, { minHeight: height }]}>
      <Skeleton width={140} height={14} />
      <Skeleton width="100%" height={10} style={{ marginTop: 12 }} />
      <Skeleton width="90%" height={10} style={{ marginTop: 6 }} />
      <Skeleton width="60%" height={10} style={{ marginTop: 6 }} />
    </View>
  );
}

/** Skeleton for a list row with leading icon + 2 text lines */
export function RowSkeleton() {
  const { mode: uiMode } = useTheme();
  const skelStyles = skelStylesByMode[uiMode];
  return (
    <View style={skelStyles.row}>
      <Skeleton width={44} height={44} borderRadius={22} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="60%" height={12} />
        <Skeleton width="40%" height={9} />
      </View>
    </View>
  );
}

const skelStylesByMode = makeModeStyles((t) => StyleSheet.create({
  card: {
    backgroundColor: t.c.white,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: t.c.paperShadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
}));
