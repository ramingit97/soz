import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { HBPet, type HBPetMood, type HBPetProps } from '@/components/HBPet';

export interface ReactingPetHandle {
  /** One-shot reaction: happy pop on 'correct', gentle sad dip on 'wrong'. */
  react: (kind: 'correct' | 'wrong') => void;
}

/**
 * HBPet wrapper that can celebrate or sympathize for ~1.4s and then return
 * to its normal mood. The burst lives on an OUTER Animated.View so it
 * composes with HBPet's internal idle bob/blink.
 */
export const ReactingPet = forwardRef<ReactingPetHandle, HBPetProps>(
  function ReactingPet(props, ref) {
    const [moodOverride, setMoodOverride] = useState<HBPetMood | null>(null);
    const scale = useSharedValue(1);
    const rotate = useSharedValue(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        react(kind) {
          if (timer.current) clearTimeout(timer.current);
          setMoodOverride(kind === 'correct' ? 'happy' : 'sad');
          if (kind === 'correct') {
            scale.value = withSequence(
              withSpring(1.18, { damping: 5, stiffness: 220 }),
              withSpring(1),
            );
            rotate.value = withSequence(
              withTiming(-7, { duration: 80 }),
              withTiming(7, { duration: 130 }),
              withTiming(0, { duration: 100 }),
            );
          } else {
            scale.value = withSequence(withTiming(0.93, { duration: 100 }), withSpring(1));
            rotate.value = withSequence(
              withTiming(-4, { duration: 70 }),
              withTiming(4, { duration: 70 }),
              withTiming(0, { duration: 70 }),
            );
          }
          timer.current = setTimeout(() => setMoodOverride(null), 1400);
        },
      }),
      [],
    );

    useEffect(
      () => () => {
        if (timer.current) clearTimeout(timer.current);
      },
      [],
    );

    const style = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
    }));

    return (
      <Animated.View style={style}>
        <HBPet {...props} mood={moodOverride ?? props.mood} />
      </Animated.View>
    );
  },
);
