/**
 * Сцена главного экрана детского режима — «волшебный остров» из макета C
 * (`context/mockups/soz-design-C-magic-island.html`).
 *
 * Закатное небо, звёзды, облака, парящий остров с домиком Бобо и гранатовым
 * деревом, вдали второй остров с Девичьей башней и водопадом.
 *
 * Холст 290 × 470 растягивается по ширине экрана и прижимается низом, поэтому
 * верхние ~80 единиц обрезаются на телефоне — всё важное лежит ниже.
 *
 * Всё рисуется ОДНИМ `Svg`, а не десятком компонентов: на Galaxy A21s каждый
 * отдельный `Svg` — это свой слой отрисовки, и десяток слоёв заметно роняет
 * прокрутку. Движение только у облаков и звёзд, и оно выключается на слабом
 * экране и при «уменьшить движение» (`useSceneMotion`).
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { useCompactScreen } from '@/hooks/useCompactScreen';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const AG = Animated.createAnimatedComponent(G);

/** Ширина холста сцены. Высота задаётся пропом, картинка обрезается по бокам. */
const VB_W = 290;
const VB_H = 470;

/**
 * Двигать ли второстепенные детали сцены.
 *
 * Короткий экран — признак дешёвого телефона (A21s: 320 × 712 dp), а
 * `useReducedMotion` — системная настройка. В обоих случаях облака и мерцание
 * звёзд замирают; сам Бобо продолжает дышать, потому что он и есть главное.
 */
export function useSceneMotion(): boolean {
  const reduced = useReducedMotion();
  const { short } = useCompactScreen();
  return !reduced && !short;
}

interface Props {
  /** Высота сцены в dp. Небо тянется до самого низа. */
  height: number;
}

export function HomeScene({ height }: Props) {
  const motion = useSceneMotion();
  const drift = useSharedValue(0);
  const twinkle = useSharedValue(1);

  useEffect(() => {
    if (!motion) return;
    drift.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.quad) }), -1, true);
    twinkle.value = withRepeat(withTiming(0.3, { duration: 2400, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => {
      cancelAnimation(drift);
      cancelAnimation(twinkle);
    };
  }, [motion, drift, twinkle]);

  const cloudProps = useAnimatedProps(() => ({
    transform: [{ translateX: -22 + drift.value * 44 }],
  }));
  const starProps = useAnimatedProps(() => ({ opacity: twinkle.value }));

  return (
    <View style={[styles.root, { height }]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMax slice">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#3B2FB5" />
            <Stop offset="0.3" stopColor="#7A5CF0" />
            <Stop offset="0.52" stopColor="#FF8FB0" />
            <Stop offset="0.68" stopColor="#FFC58F" />
            <Stop offset="1" stopColor="#FFE9BF" />
          </LinearGradient>
          <RadialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#FFF6C9" stopOpacity="0.95" />
            <Stop offset="1" stopColor="#FFF6C9" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="earth" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#C58449" />
            <Stop offset="1" stopColor="#5E3520" />
          </LinearGradient>
          <LinearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#A4F587" />
            <Stop offset="1" stopColor="#43C466" />
          </LinearGradient>
          <LinearGradient id="cloud" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#FFD3E4" />
          </LinearGradient>
          <LinearGradient id="wall" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFF8EA" />
            <Stop offset="1" stopColor="#F3DDBB" />
          </LinearGradient>
          <LinearGradient id="roof" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FF8FB0" />
            <Stop offset="1" stopColor="#E8386A" />
          </LinearGradient>
          <LinearGradient id="tower" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#F6DFB9" />
            <Stop offset="1" stopColor="#C79C68" />
          </LinearGradient>
          <RadialGradient id="tree" cx="0.35" cy="0.3" r="0.8">
            <Stop offset="0" stopColor="#6FE08A" />
            <Stop offset="1" stopColor="#1F8F4E" />
          </RadialGradient>
        </Defs>

        <Rect width={VB_W} height={VB_H} fill="url(#sky)" />

        {/* Звёзды на тёмной части неба */}
        <AG animatedProps={motion ? starProps : undefined} opacity={motion ? undefined : 0.75}>
          <Circle cx={30} cy={104} r={1.6} fill="#fff" />
          <Circle cx={168} cy={96} r={1.7} fill="#fff" />
          <Circle cx={140} cy={128} r={1.3} fill="#fff" />
          <Circle cx={96} cy={112} r={1.2} fill="#fff" />
          <Circle cx={72} cy={142} r={1.4} fill="#fff" />
        </AG>

        {/* Тёплое свечение за героем */}
        <Circle cx={145} cy={300} r={190} fill="url(#glow)" />

        {/* Дальний остров с Девичьей башней и водопадом */}
        <G>
          <Path d="M204 148 Q216 186 240 196 Q252 202 264 195 Q286 186 292 148Z" fill="url(#earth)" />
          <Ellipse cx={248} cy={149} rx={46} ry={12} fill="url(#grass)" />
          <G>
            <Rect x={252} y={92} width={11} height={28} rx={3} fill="#B98C58" />
            <Rect x={236} y={82} width={20} height={38} rx={4} fill="url(#tower)" />
            <Rect x={234} y={78} width={24} height={6} rx={2} fill="#D9B17C" />
            <Rect x={241} y={92} width={3} height={5} rx={1.5} fill="#7A5A35" />
          </G>
          <Path d="M216 156 v40" stroke="#C9F6FF" strokeWidth={6} strokeLinecap="round" opacity={0.65} fill="none" />
        </G>

        {/* Облака */}
        <AG animatedProps={motion ? cloudProps : undefined}>
          <Ellipse cx={246} cy={210} rx={30} ry={10} fill="url(#cloud)" />
          <Ellipse cx={262} cy={202} rx={19} ry={10} fill="url(#cloud)" />
          <Ellipse cx={34} cy={238} rx={26} ry={9} fill="url(#cloud)" opacity={0.9} />
          <Ellipse cx={46} cy={231} rx={16} ry={9} fill="url(#cloud)" opacity={0.9} />
        </AG>

        {/* Главный остров */}
        <G>
          <Path d="M-6 330 Q28 452 108 470 Q145 484 182 468 Q262 450 296 330Z" fill="url(#earth)" />
          <Path d="M60 356 l16 56 l20 -48Z" fill="#DDA06A" opacity={0.45} />
          <Path d="M176 352 l12 52 l24 -50Z" fill="#4C2A18" opacity={0.4} />
          <Ellipse cx={145} cy={334} rx={152} ry={38} fill="#279B55" />
          <Ellipse cx={145} cy={324} rx={155} ry={40} fill="url(#grass)" />
          <Ellipse cx={100} cy={312} rx={70} ry={12} fill="#FFFFFF" opacity={0.16} />
        </G>

        {/* Домик Бобо */}
        <G>
          <Rect x={218} y={286} width={44} height={34} rx={6} fill="url(#wall)" />
          <Path d="M210 290 240 264l30 26a4 4 0 0 1-3 6h-54a4 4 0 0 1-3-6Z" fill="url(#roof)" />
          <Rect x={252} y={268} width={8} height={14} rx={2.5} fill="#C22B5A" />
          <Rect x={232} y={300} width={13} height={20} rx={6} fill="#23B9D2" />
          <Circle cx={242} cy={311} r={1.6} fill="#FFE27A" />
          <Rect x={222} y={293} width={9} height={9} rx={2.5} fill="#FFE27A" />
        </G>

        {/* Гранатовое дерево */}
        <G>
          <Rect x={38} y={296} width={7} height={26} rx={3} fill="#8A5230" />
          <Circle cx={41} cy={288} r={20} fill="url(#tree)" />
          <Circle cx={26} cy={300} r={11} fill="url(#tree)" />
          <Circle cx={56} cy={300} r={11} fill="url(#tree)" />
          <Circle cx={32} cy={284} r={4} fill="#FF4F6D" />
          <Circle cx={48} cy={294} r={4} fill="#FF4F6D" />
          <Circle cx={46} cy={278} r={4} fill="#FF4F6D" />
        </G>

        {/* Цветы на траве */}
        <G>
          <Circle cx={92} cy={330} r={3.5} fill="#fff" />
          <Circle cx={92} cy={330} r={1.4} fill="#FFC83A" />
          <Circle cx={186} cy={334} r={3.5} fill="#fff" />
          <Circle cx={186} cy={334} r={1.4} fill="#FFC83A" />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, top: 0 },
});
