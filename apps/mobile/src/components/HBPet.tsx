/**
 * HBPet — "Хани" the clay-blob mascot.
 *
 * Recreates the Honeybear soft-claymorphism pet from the Claude Design handoff
 * using react-native-svg: layered radial gradients on a squircle body with
 * ear tufts, soft cheeks, glossy highlight, and a sweet smile.
 *
 * Animations:
 *  - idle bob (slow vertical bounce) when mood !== 'sleepy'
 *  - random blink (every 3-6s)
 *  - talk pulse (continuous scale wobble) when `talking` is true
 *  - mood-driven eyebrow tilt for curious / sad / sleepy
 */

import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { useReducedMotion } from '@/hooks/useReducedMotion';

type Mood = 'happy' | 'sleepy' | 'curious' | 'sad';
export type HBPetMood = Mood;

export interface HBPetProps {
  size?: number;
  /** Base hue in degrees (50 = honey peach, 175 = sage, 300 = berry). */
  hue?: number;
  /** Chroma — how saturated the body is (default 0.16). */
  chroma?: number;
  eyes?: boolean;
  mood?: Mood;
  /** Stronger continuous wobble used while Bobo is "speaking". */
  talking?: boolean;
  /** Disable all motion (use when many pets are on-screen). */
  still?: boolean;
  /** Occasional idle gestures (tilt / stretch / sway) so the pet doesn't read as
   * a flat loop. On by default; auto-suppressed while talking, sleepy, still, or
   * under reduced-motion. */
  idleGestures?: boolean;
  /** When provided, the pet becomes tappable and does a happy wiggle on press. */
  onTap?: () => void;
}

// Approximate oklch(L C h) → hex helper.
function paletteFor(hue: number, _chroma: number) {
  const presets: Record<number, { light: string; body: string; deep: string; cheek: string }> = {
    55: {
      light: '#FBD9B5',
      body: '#E8A877',
      deep: '#B47B47', // lifted from #A86334 — matte, less glossy edge
      cheek: '#E08A6A',
    },
    175: {
      light: '#C9EADF',
      body: '#7DC6B5',
      deep: '#469684', // lifted from #3C8674
      cheek: '#E0C16A',
    },
    300: {
      light: '#E8D2EA',
      body: '#C593C8',
      deep: '#8C5C90', // lifted from #7E4F82
      cheek: '#C97090',
    },
    90: {
      light: '#F2E5B0',
      body: '#D6BC6A',
      deep: '#9C8138', // lifted from #8F7430
      cheek: '#D9A04A',
    },
    25: {
      // coral / tangerine
      light: '#FCD3C0',
      body: '#F0936F',
      deep: '#C25C3C',
      cheek: '#E88A6E',
    },
    230: {
      // sky blue
      light: '#CFE2F7',
      body: '#84B0E6',
      deep: '#5180BC',
      cheek: '#E89AAE',
    },
    350: {
      // rose / pink
      light: '#FAD3DD',
      body: '#ED8AA6',
      deep: '#C25876',
      cheek: '#E88AA0',
    },
  };
  const hues = Object.keys(presets).map(Number);
  const closest = hues.reduce((a, b) => (Math.abs(b - hue) < Math.abs(a - hue) ? b : a));
  return presets[closest]!;
}

export function HBPet({
  size = 110,
  hue = 55,
  chroma = 0.16,
  eyes = true,
  mood = 'happy',
  talking = false,
  still = false,
  idleGestures = true,
  onTap,
}: HBPetProps) {
  const p = paletteFor(hue, chroma);
  const w = size;
  const h = size * 0.95;
  const VB_W = 100;
  const VB_H = 95;

  const eyeY = 45;
  const eyeRX = 5;
  const eyeRY = 6.5;
  const isSleepy = mood === 'sleepy';
  const isSad = mood === 'sad';
  const isCurious = mood === 'curious';

  // ─── Animation state ──────────────────────────────────────────────────────
  const reduced = useReducedMotion();
  const motionOff = still || reduced;
  const bobY = useSharedValue(0);
  const breathe = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  // Idle-gesture channels (layered on top of the breathing bob)
  const gRot = useSharedValue(0);
  const gTx = useSharedValue(0);
  const gScaleY = useSharedValue(1);
  const [blinking, setBlinking] = useState(false);

  // A one-shot happy wiggle — used for tap reactions and as one of the gestures.
  const wiggle = () => {
    gScaleY.value = withSequence(withTiming(1.12, { duration: 140 }), withSpring(1, { damping: 8 }));
    gRot.value = withSequence(
      withTiming(-5, { duration: 80 }),
      withTiming(5, { duration: 80 }),
      withTiming(0, { duration: 140 }),
    );
  };

  useEffect(() => {
    if (motionOff || isSleepy) {
      bobY.value = withTiming(0, { duration: 200 });
      breathe.value = withTiming(1, { duration: 200 });
      return;
    }
    // Weighted breathing — quick inhale, brief hold, slow exhale (not a flat sine)
    bobY.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 900 }),
        withTiming(-3.4, { duration: 300 }),
        withTiming(0, { duration: 1500 }),
      ),
      -1,
      false,
    );
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 900 }),
        withTiming(1.03, { duration: 300 }),
        withTiming(1, { duration: 1500 }),
      ),
      -1,
      false,
    );
  }, [motionOff, isSleepy]);

  useEffect(() => {
    if (motionOff || !talking) {
      pulseScale.value = withTiming(1, { duration: 200 });
      return;
    }
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 220 }),
        withTiming(0.97, { duration: 220 }),
      ),
      -1,
      true,
    );
  }, [motionOff, talking]);

  // Random blink — every ~3-6 seconds, eyes close for 110ms
  useEffect(() => {
    if (motionOff || isSleepy || !eyes) return;
    let cancelled = false;
    const schedule = () => {
      const delay = 3000 + Math.random() * 3000;
      setTimeout(() => {
        if (cancelled) return;
        setBlinking(true);
        setTimeout(() => {
          if (cancelled) return;
          setBlinking(false);
          schedule();
        }, 110);
      }, delay);
    };
    schedule();
    return () => { cancelled = true; };
  }, [motionOff, isSleepy, eyes]);

  // Occasional idle gestures — a random tilt / stretch / sway every ~6-12s so the
  // pet reads as alive rather than a fixed breathing loop. Suppressed while
  // talking, sleepy, still, or reduced-motion.
  useEffect(() => {
    if (motionOff || isSleepy || talking || !idleGestures) return;
    let cancelled = false;
    const run = () => {
      const pick = Math.floor(Math.random() * 4);
      if (pick === 0) {
        // tilt head
        const dir = Math.random() < 0.5 ? -1 : 1;
        gRot.value = withSequence(withTiming(6 * dir, { duration: 320 }), withTiming(0, { duration: 520 }));
      } else if (pick === 1) {
        // stretch / yawn
        gScaleY.value = withSequence(withTiming(1.09, { duration: 360 }), withSpring(1, { damping: 9 }));
      } else if (pick === 2) {
        // sway — look side to side
        gTx.value = withSequence(
          withTiming(5, { duration: 420 }),
          withTiming(-5, { duration: 620 }),
          withTiming(0, { duration: 420 }),
        );
      } else {
        // little happy wiggle
        wiggle();
      }
    };
    const schedule = () => {
      const delay = 6000 + Math.random() * 6000;
      setTimeout(() => {
        if (cancelled) return;
        run();
        schedule();
      }, delay);
    };
    schedule();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionOff, isSleepy, talking, idleGestures]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: gTx.value },
      { translateY: bobY.value },
      { rotate: `${gRot.value}deg` },
      { scale: pulseScale.value },
      { scaleY: breathe.value * gScaleY.value },
    ],
  }));

  const petBody = (
    <Animated.View style={[{ width: w, height: h }, animStyle]}>
      <Svg width={w} height={h} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Defs>
          <RadialGradient id="body" cx="35%" cy="30%" rx="60%" ry="70%">
            <Stop offset="0%" stopColor={p.light} stopOpacity={1} />
            <Stop offset="55%" stopColor={p.body} stopOpacity={1} />
            <Stop offset="100%" stopColor={p.deep} stopOpacity={1} />
          </RadialGradient>
          <RadialGradient id="ear" cx="40%" cy="35%" rx="60%" ry="70%">
            <Stop offset="0%" stopColor={p.light} stopOpacity={1} />
            <Stop offset="60%" stopColor={p.body} stopOpacity={1} />
            <Stop offset="100%" stopColor={p.deep} stopOpacity={1} />
          </RadialGradient>
        </Defs>

        {/* left ear/tuft */}
        <Path
          d={`M 22 8
              Q 18 -2 28 0
              Q 38 2 36 14
              Q 35 22 30 22
              Q 22 22 22 8 Z`}
          fill="url(#ear)"
        />
        {/* right ear/tuft */}
        <Path
          d={`M 78 8
              Q 82 -2 72 0
              Q 62 2 64 14
              Q 65 22 70 22
              Q 78 22 78 8 Z`}
          fill="url(#ear)"
        />

        {/* body — squircle */}
        <Path
          d={`M 50 8
              C 78 8 92 26 92 52
              C 92 78 76 92 50 92
              C 24 92 8 78 8 52
              C 8 26 22 8 50 8 Z`}
          fill="url(#body)"
        />

        {/* cheeks */}
        <Ellipse cx="22" cy="60" rx="9" ry="5" fill={p.cheek} opacity={0.45} />
        <Ellipse cx="78" cy="60" rx="9" ry="5" fill={p.cheek} opacity={0.45} />

        {/* eyebrows — only when curious or sad */}
        {eyes && isCurious && (
          <G>
            <Path d="M 28 36 L 40 34" stroke="#1A1612" strokeWidth={2} strokeLinecap="round" />
            <Path d="M 60 34 L 72 36" stroke="#1A1612" strokeWidth={2} strokeLinecap="round" />
          </G>
        )}
        {eyes && isSad && (
          <G>
            <Path d="M 28 34 L 40 38" stroke="#1A1612" strokeWidth={2} strokeLinecap="round" />
            <Path d="M 60 38 L 72 34" stroke="#1A1612" strokeWidth={2} strokeLinecap="round" />
          </G>
        )}

        {/* eyes — open / blinking / sleepy */}
        {eyes && !isSleepy && !blinking && (
          <G>
            <Ellipse cx="34" cy={eyeY} rx={eyeRX} ry={eyeRY} fill="#1A1612" />
            <Ellipse cx="66" cy={eyeY} rx={eyeRX} ry={eyeRY} fill="#1A1612" />
            {/* sparkle */}
            <Ellipse cx="32" cy={eyeY - 2} rx={1.6} ry={2} fill="#FFFFFF" />
            <Ellipse cx="64" cy={eyeY - 2} rx={1.6} ry={2} fill="#FFFFFF" />
          </G>
        )}
        {eyes && !isSleepy && blinking && (
          <G>
            <Path d="M 28 45 L 40 45" stroke="#1A1612" strokeWidth={2.2} strokeLinecap="round" />
            <Path d="M 60 45 L 72 45" stroke="#1A1612" strokeWidth={2.2} strokeLinecap="round" />
          </G>
        )}
        {eyes && isSleepy && (
          <G>
            <Path d="M 28 46 Q 34 50 40 46" stroke="#1A1612" strokeWidth={2.2} fill="none" strokeLinecap="round" />
            <Path d="M 60 46 Q 66 50 72 46" stroke="#1A1612" strokeWidth={2.2} fill="none" strokeLinecap="round" />
          </G>
        )}

        {/* smile / mouth */}
        {!isSad && !talking && (
          <Path d="M 40 65 Q 50 73 60 65" stroke="#1A1612" strokeWidth={2.4} fill="none" strokeLinecap="round" />
        )}
        {!isSad && talking && (
          // Soft open mouth with a hint of tongue (not a flat black hole)
          <G>
            <Path d="M 41 64 Q 50 75 59 64 Q 50 70 41 64 Z" fill="#4A2E22" />
            <Ellipse cx="50" cy="67" rx="3.6" ry="2" fill={p.cheek} opacity={0.85} />
          </G>
        )}
        {isSad && (
          <Path d="M 40 71 Q 50 64 60 71" stroke="#1A1612" strokeWidth={2.4} fill="none" strokeLinecap="round" />
        )}

        {/* soft top-rim highlight (matte plush, not a glossy balloon) */}
        <Ellipse cx="36" cy="20" rx="12" ry="5" fill="#FFFFFF" opacity={0.2} />
      </Svg>
    </Animated.View>
  );

  if (onTap) {
    return (
      <Pressable
        onPress={() => {
          if (!motionOff) wiggle();
          onTap();
        }}
        hitSlop={8}
      >
        {petBody}
      </Pressable>
    );
  }

  return petBody;
}

export default HBPet;
