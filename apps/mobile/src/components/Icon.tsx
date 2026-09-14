/**
 * Icon — единственный способ нарисовать иконку интерфейса. Эмодзи для этого не
 * использовать: на разных телефонах они разные и выглядят инородно рядом с
 * текстом. Эмодзи остаются только в контенте — уроки, реплики Хани, ответы квизов.
 *
 * Карта закрытая: новая иконка добавляется сюда строкой импорта. Импорт ровно по
 * одной иконке через `lucide-react-native/icons/<имя>`, НЕ из корня пакета: Metro
 * не вырезает неиспользуемый код, и `import { Star } from 'lucide-react-native'`
 * затянул бы в бандл все ~1600 иконок.
 */
import type { LucideIcon } from 'lucide-react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import Baby from 'lucide-react-native/icons/baby';
import Backpack from 'lucide-react-native/icons/backpack';
import Bell from 'lucide-react-native/icons/bell';
import Book from 'lucide-react-native/icons/book';
import BookOpen from 'lucide-react-native/icons/book-open';
import Bot from 'lucide-react-native/icons/bot';
import Brain from 'lucide-react-native/icons/brain';
import Calendar from 'lucide-react-native/icons/calendar';
import Camera from 'lucide-react-native/icons/camera';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import Check from 'lucide-react-native/icons/check';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import Crown from 'lucide-react-native/icons/crown';
import Drama from 'lucide-react-native/icons/drama';
import Dumbbell from 'lucide-react-native/icons/dumbbell';
import Flame from 'lucide-react-native/icons/flame';
import Gift from 'lucide-react-native/icons/gift';
import Globe from 'lucide-react-native/icons/globe';
import GraduationCap from 'lucide-react-native/icons/graduation-cap';
import Headphones from 'lucide-react-native/icons/headphones';
import Heart from 'lucide-react-native/icons/heart';
import House from 'lucide-react-native/icons/house';
import Library from 'lucide-react-native/icons/library';
import Lightbulb from 'lucide-react-native/icons/lightbulb';
import Lock from 'lucide-react-native/icons/lock';
import MapIcon from 'lucide-react-native/icons/map';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import MessageCircleDashed from 'lucide-react-native/icons/message-circle-dashed';
import MessagesSquare from 'lucide-react-native/icons/messages-square';
import Mic from 'lucide-react-native/icons/mic';
import Moon from 'lucide-react-native/icons/moon';
import Music from 'lucide-react-native/icons/music';
import PartyPopper from 'lucide-react-native/icons/party-popper';
import Play from 'lucide-react-native/icons/play';
import Plus from 'lucide-react-native/icons/plus';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Repeat from 'lucide-react-native/icons/repeat';
import Rocket from 'lucide-react-native/icons/rocket';
import Save from 'lucide-react-native/icons/save';
import Scale from 'lucide-react-native/icons/scale';
import Settings from 'lucide-react-native/icons/settings';
import Snowflake from 'lucide-react-native/icons/snowflake';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Star from 'lucide-react-native/icons/star';
import Target from 'lucide-react-native/icons/target';
import Trophy from 'lucide-react-native/icons/trophy';
import User from 'lucide-react-native/icons/user';
import Volume2 from 'lucide-react-native/icons/volume-2';
import Wrench from 'lucide-react-native/icons/wrench';
import X from 'lucide-react-native/icons/x';
import Zap from 'lucide-react-native/icons/zap';

import { useUIMode } from '@/hooks/useUIMode';
import { colors } from '@/theme';
import { MODE_TOKENS } from '@/theme/modeTokens';

const ICONS = {
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  baby: Baby,
  backpack: Backpack,
  bell: Bell,
  book: Book,
  'book-open': BookOpen,
  bot: Bot,
  brain: Brain,
  calendar: Calendar,
  camera: Camera,
  'chart-column': ChartColumn,
  check: Check,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'circle-alert': CircleAlert,
  'circle-check': CircleCheck,
  'clipboard-list': ClipboardList,
  crown: Crown,
  drama: Drama,
  dumbbell: Dumbbell,
  flame: Flame,
  gift: Gift,
  globe: Globe,
  'graduation-cap': GraduationCap,
  headphones: Headphones,
  heart: Heart,
  house: House,
  library: Library,
  lightbulb: Lightbulb,
  lock: Lock,
  map: MapIcon,
  'message-circle': MessageCircle,
  'message-circle-dashed': MessageCircleDashed,
  'messages-square': MessagesSquare,
  mic: Mic,
  moon: Moon,
  music: Music,
  'party-popper': PartyPopper,
  play: Play,
  plus: Plus,
  'refresh-cw': RefreshCw,
  repeat: Repeat,
  rocket: Rocket,
  save: Save,
  scale: Scale,
  settings: Settings,
  snowflake: Snowflake,
  sparkles: Sparkles,
  star: Star,
  target: Target,
  trophy: Trophy,
  user: User,
  'volume-2': Volume2,
  wrench: Wrench,
  x: X,
  zap: Zap,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** По умолчанию из режима: kid толще, teen тоньше. */
  strokeWidth?: number;
  /** Залить фигуру (звезда, сердце, пламя) — для «заработанного» состояния. */
  fill?: string;
  accessibilityLabel?: string;
}

export function Icon({
  name,
  size = 24,
  color = colors.ink,
  strokeWidth,
  fill = 'none',
  accessibilityLabel,
}: IconProps) {
  const mode = useUIMode();
  const Glyph = ICONS[name];
  return (
    <Glyph
      size={size}
      color={color}
      fill={fill}
      strokeWidth={strokeWidth ?? MODE_TOKENS[mode].iconStroke}
      accessibilityLabel={accessibilityLabel}
      accessible={accessibilityLabel ? true : undefined}
    />
  );
}
