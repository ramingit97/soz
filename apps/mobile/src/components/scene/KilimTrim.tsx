/**
 * Кромка с узором килима — верхний край плашки «Верно» в детском режиме
 * (макет C).
 *
 * Треугольники через один: золотой и белый. Это единственное место, где в
 * интерфейсе появляется местный орнамент, и появляется он в самый радостный
 * момент урока — когда ответ верный.
 */
import Svg, { Path } from 'react-native-svg';

/** Ширина холста; растягивается по ширине плашки. */
const W = 240;
const H = 12;
const STEP = 20;

const teeth = (offset: number) => {
  let d = '';
  for (let x = offset; x < W; x += STEP * 2) {
    d += `M${x} ${H} L${x + STEP / 2} 1 L${x + STEP} ${H}Z `;
  }
  return d.trim();
};

const GOLD = teeth(0);
const WHITE = teeth(STEP);

export function KilimTrim({ height = 12 }: { height?: number }) {
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Path d={GOLD} fill="#FFE27A" />
      <Path d={WHITE} fill="#FFFFFF" opacity={0.85} />
    </Svg>
  );
}
