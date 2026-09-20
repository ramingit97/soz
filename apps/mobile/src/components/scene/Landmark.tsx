/**
 * Остров-веха на карте «Пути»: место Азербайджана, к которому ведёт неделя.
 *
 * Девичья башня, Гобустан, крыша шекинского дома, Пламенные башни. Своя
 * география — то, чего нет ни у одного конкурента, и ребёнку понятно, куда он
 * идёт: не «неделя 2», а «Гобустан».
 */
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { World } from '@/data/worlds';

interface Props {
  kind: World['landmark'];
  size?: number;
  /** Неделя ещё закрыта — остров в сиреневом тумане. */
  locked?: boolean;
}

export function Landmark({ kind, size = 108, locked = false }: Props) {
  const grass = locked ? '#B9AEE6' : undefined;
  const earth = locked ? '#7E6EC4' : undefined;
  return (
    <Svg width={size} height={size * (86 / 120)} viewBox="0 0 120 86">
      <Defs>
        <LinearGradient id="lmEarth" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={earth ?? '#C58449'} />
          <Stop offset="1" stopColor={earth ?? '#5E3520'} />
        </LinearGradient>
        <LinearGradient id="lmGrass" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={grass ?? '#A4F587'} />
          <Stop offset="1" stopColor={grass ?? '#43C466'} />
        </LinearGradient>
        <LinearGradient id="lmStone" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#F6DFB9" />
          <Stop offset="1" stopColor="#C79C68" />
        </LinearGradient>
        <LinearGradient id="lmGlass" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8FD8F2" />
          <Stop offset="1" stopColor="#2E7BD6" />
        </LinearGradient>
      </Defs>

      {kind === 'tower' ? (
        <>
          <Rect x={64} y={24} width={12} height={34} rx={3} fill="#B98C58" opacity={locked ? 0.5 : 1} />
          <Rect x={46} y={14} width={22} height={44} rx={5} fill="url(#lmStone)" opacity={locked ? 0.5 : 1} />
          <Rect x={44} y={9} width={26} height={7} rx={2.5} fill="#D9B17C" opacity={locked ? 0.5 : 1} />
          <Rect x={52} y={26} width={4} height={7} rx={2} fill="#7A5A35" opacity={locked ? 0.5 : 1} />
        </>
      ) : null}

      {kind === 'rocks' ? (
        <>
          <Path d="M36 58 52 22l16 36Z" fill="#9C8570" opacity={locked ? 0.5 : 1} />
          <Path d="M58 58 72 32l14 26Z" fill="#7E6A58" opacity={locked ? 0.5 : 1} />
          <Path d="M48 44h10M60 50h12" stroke="#5B4A3C" strokeWidth={2} strokeLinecap="round" opacity={locked ? 0.4 : 0.8} />
        </>
      ) : null}

      {kind === 'roof' ? (
        <>
          <Rect x={42} y={34} width={38} height={24} rx={4} fill="#FFF8EA" opacity={locked ? 0.5 : 1} />
          <Path d="M34 36 61 14l27 22a4 4 0 0 1-3 6H37a4 4 0 0 1-3-6Z" fill="#E8386A" opacity={locked ? 0.5 : 1} />
          <Rect x={50} y={40} width={9} height={12} rx={2} fill="url(#lmGlass)" opacity={locked ? 0.5 : 1} />
          <Rect x={64} y={40} width={9} height={12} rx={2} fill="url(#lmGlass)" opacity={locked ? 0.5 : 1} />
        </>
      ) : null}

      {kind === 'flames' ? (
        <>
          <Path d="M38 58 C34 34 42 20 52 8 C58 24 62 42 58 58Z" fill="url(#lmGlass)" opacity={locked ? 0.5 : 1} />
          <Path d="M58 58 C55 36 62 24 72 12 C78 28 80 44 76 58Z" fill="url(#lmGlass)" opacity={locked ? 0.5 : 1} />
          <Path d="M76 58 C74 40 80 30 88 20 C92 34 94 46 90 58Z" fill="url(#lmGlass)" opacity={locked ? 0.5 : 1} />
        </>
      ) : null}

      <Path d="M18 58 Q28 80 56 86 Q66 90 76 85 Q100 78 106 58Z" fill="url(#lmEarth)" />
      <Ellipse cx={62} cy={58} rx={46} ry={12} fill="url(#lmGrass)" />
    </Svg>
  );
}
