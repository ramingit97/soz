/**
 * «Программа» — вкладка «Путь» во взрослом режиме (макет D).
 *
 * Взрослому нужна не карта, а план: какой уровень сейчас, сколько до
 * следующего, что в этой неделе и что откроется дальше. Пройденные уроки
 * показывают звёзды, текущий — кнопку «Начать», будущие приглушены.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';
import { WORLDS, worldForDay, type World } from '@/data/worlds';

interface Props {
  currentDay: number;
  maxDay: number;
  /** Уровень CEFR из профиля, например «B1». */
  level: string | null;
  isAz: boolean;
  /** Тема урока по номеру дня — из встроенного курса или плана ИИ. */
  themeForDay: (day: number) => string | null;
  onPressDay: (day: number) => void;
}

/** Следующий уровень после текущего — сколько ещё уроков до него. */
const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;

export function ProgramList({ currentDay, maxDay, level, isAz, themeForDay, onPressDay }: Props) {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const world = worldForDay(currentDay);
  const nextLevel = level ? LEVELS[LEVELS.indexOf(level as (typeof LEVELS)[number]) + 1] : null;
  const left = Math.max(0, maxDay - currentDay + 1);
  const progress = Math.min(1, Math.max(0, (currentDay - 1) / maxDay));

  const days = Array.from(
    { length: world.endDay - world.startDay + 1 },
    (_, i) => world.startDay + i,
  );
  const nextWorld: World | undefined = WORLDS[WORLDS.indexOf(world) + 1];

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.levelHead}>
          <Text variant="bodyBold">
            {level ? (isAz ? `Səviyyə ${level}` : `Уровень ${level}`) : isAz ? 'Kurs' : 'Курс'}
          </Text>
          <Text variant="caption" tone="secondary">
            {nextLevel
              ? isAz ? `${nextLevel}-ə ${left} dərs` : `до ${nextLevel}: ${left} ${plural(left, 'урок', 'урока', 'уроков')}`
              : isAz ? `${left} dərs qalıb` : `осталось ${left} ${plural(left, 'урок', 'урока', 'уроков')}`}
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: c.card }]}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: c.accent }]} />
        </View>
      </View>

      <View style={styles.weekHead}>
        <Text variant="bodyBold">
          {isAz ? `${weekNo(world)}-ci həftə: ${world.labelAz}` : `Неделя ${weekNo(world)}: ${world.labelRu}`}
        </Text>
        <Text variant="caption" tone="secondary">
          {`${Math.min(days.length, Math.max(0, currentDay - world.startDay))} / ${days.length}`}
        </Text>
      </View>

      <View style={styles.card}>
        {days.map((day, i) => {
          const state = day < currentDay ? 'done' : day === currentDay ? 'current' : 'locked';
          return (
            <Pressable
              key={day}
              onPress={() => onPressDay(day)}
              disabled={state === 'locked'}
              accessibilityRole="button"
              style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.surfaceBorder }]}
            >
              <View
                style={[
                  styles.num,
                  { borderColor: c.borderStrong },
                  state === 'done' && { backgroundColor: c.accent, borderColor: c.accent },
                  state === 'current' && { borderColor: c.gold },
                ]}
              >
                {state === 'done' ? (
                  <Icon name="check" size={13} color={c.bg} strokeWidth={3} />
                ) : (
                  <Text variant="caption" style={{ color: state === 'current' ? c.gold : c.textMuted }}>
                    {day - world.startDay + 1}
                  </Text>
                )}
              </View>
              <Text
                variant={state === 'locked' ? 'body' : 'bodyBold'}
                tone={state === 'locked' ? 'muted' : 'primary'}
                numberOfLines={1}
                style={styles.rowTitle}
              >
                {themeForDay(day) ?? (isAz ? `Dərs ${day}` : `Урок ${day}`)}
              </Text>
              {state === 'current' ? (
                <View style={[styles.go, { backgroundColor: c.cta }]}>
                  <Text variant="caption" style={{ color: c.ctaText }}>{isAz ? 'Başla' : 'Начать'}</Text>
                </View>
              ) : (
                <Text variant="caption" tone="secondary">
                  {state === 'done' ? (isAz ? 'bitdi' : 'пройден') : (isAz ? '15 dəq' : '15 мин')}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {nextWorld ? (
        <View style={[styles.card, styles.lockedWeek]}>
          <Icon name="lock" size={18} color={c.textMuted} />
          <Text variant="body" tone="muted" numberOfLines={1} style={styles.rowTitle}>
            {isAz
              ? `${weekNo(nextWorld)}-ci həftə: ${nextWorld.labelAz}`
              : `Неделя ${weekNo(nextWorld)}: ${nextWorld.labelRu}`}
          </Text>
          <Icon name="chevron-right" size={18} color={c.textMuted} />
        </View>
      ) : null}
    </View>
  );
}

const weekNo = (w: World) => WORLDS.indexOf(w) + 1;

/** Русское склонение после числа: 1 урок, 2 урока, 5 уроков. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  root: { gap: spacing[3] },
  card: {
    backgroundColor: t.c.surface,
    borderRadius: t.card.radius,
    paddingHorizontal: t.density.cardPad,
    paddingVertical: spacing[1],
    gap: spacing[3],
  },
  levelHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing[2],
    paddingTop: spacing[3],
  },
  track: { height: 5, borderRadius: 3, marginBottom: spacing[3], overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  weekHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing[2],
    paddingHorizontal: spacing[1],
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] },
  num: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowTitle: { flex: 1, minWidth: 0 },
  go: { height: 30, borderRadius: 12, paddingHorizontal: spacing[3], alignItems: 'center', justifyContent: 'center' },
  lockedWeek: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[4] },
}));
