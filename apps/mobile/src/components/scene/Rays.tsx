/**
 * Лучи за героем на экране «урок пройден» (макет C).
 *
 * Шестнадцать светлых клиньев из центра, медленно поворачиваются. Это главный
 * праздничный приём экрана: конфетти сыплется сверху, а лучи держат середину.
 * Вращение выключается на слабом экране и при системном «уменьшить движение» —
 * тогда лучи просто стоят.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useSceneMotion } from './HomeScene';

const COUNT = 16;
const R = 100;

/** Клин от центра: половина сектора светлая, половина прозрачная. */
function wedge(i: number): string {
  const step = 360 / COUNT;
  const a0 = ((i * step - step / 4) * Math.PI) / 180;
  const a1 = ((i * step + step / 4) * Math.PI) / 180;
  const x0 = 100 + R * Math.cos(a0);
  const y0 = 100 + R * Math.sin(a0);
  const x1 = 100 + R * Math.cos(a1);
  const y1 = 100 + R * Math.sin(a1);
  return `M100 100 L${x0.toFixed(1)} ${y0.toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)}Z`;
}

const WEDGES = Array.from({ length: COUNT }, (_, i) => wedge(i));

export function Rays({ size = 420 }: { size?: number }) {
  const motion = useSceneMotion();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (!motion) return;
    spin.value = withRepeat(withTiming(360, { duration: 40000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(spin);
  }, [motion, spin]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

  return (
    <View style={[styles.root, { width: size, height: size, marginLeft: -size / 2 }]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <Svg width="100%" height="100%" viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id="rayFade" cx="0.5" cy="0.5" r="0.5">
              {/* Золотые, а не белые: белое на светло-лавандовом листе детского
                  режима почти не видно. */}
              <Stop offset="0.25" stopColor="#FFC83A" stopOpacity="0.30" />
              <Stop offset="1" stopColor="#FFC83A" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <G>
            {WEDGES.map((d, i) => (
              <Path key={i} d={d} fill="url(#rayFade)" />
            ))}
          </G>
          <Rect width={0} height={0} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: '50%', top: 0 },
});
