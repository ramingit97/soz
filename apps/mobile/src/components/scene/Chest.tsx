/**
 * Сундук — награда в конце дорожки шагов урока (макет C).
 *
 * Стоит последним в ряду «слова → грамматика → разговор»: ребёнок видит, ради
 * чего проходит урок, ещё до того как нажал кнопку. Открытый вариант — на
 * экране «урок пройден».
 */
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

interface Props {
  size?: number;
  /** Крышка приоткрыта и из щели бьёт свет — когда награда уже заработана. */
  open?: boolean;
}

export function Chest({ size = 40, open = false }: Props) {
  return (
    <Svg width={size} height={size * (44 / 48)} viewBox="0 0 48 44">
      <Defs>
        <LinearGradient id="chestGold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF08A" />
          <Stop offset="1" stopColor="#FFAE00" />
        </LinearGradient>
      </Defs>
      <Ellipse cx={24} cy={40} rx={20} ry={3.5} fill="#2A1E5C" opacity={0.2} />
      {open ? <Circle cx={24} cy={16} r={14} fill="#FFF08A" opacity={0.45} /> : null}
      <Path
        d="M5 20a11 11 0 0 1 11-11h16a11 11 0 0 1 11 11v16a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Z"
        fill="#D98A35"
      />
      <Path d="M5 20a11 11 0 0 1 11-11h16a11 11 0 0 1 11 11v2H5Z" fill={open ? '#F7BE6E' : '#F0A851'} />
      <Rect x={5} y={21} width={38} height={6} fill="#8A4A17" />
      <Path d="M12 9.5v29M36 9.5v29" stroke="#8A4A17" strokeWidth={3} />
      <Rect
        x={19.5}
        y={18}
        width={9}
        height={12}
        rx={3}
        fill="url(#chestGold)"
        stroke="#B87400"
        strokeWidth={1.2}
      />
    </Svg>
  );
}
