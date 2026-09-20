/**
 * Карта «Пути» для детского режима (макет C).
 *
 * Дорожка идёт снизу вверх: внизу пройденные дни, вверху закрытые. В конце
 * каждой недели — остров-веха с местом Азербайджана (Девичья башня, Гобустан,
 * Шеки, Пламенные башни), чтобы ребёнок шёл не в «неделю 2», а в Гобустан.
 *
 * Дорожка нарисована точками-кружками, а не SVG-путями: тридцать маленьких
 * `Svg` в прокрутке заметно роняют её на слабом телефоне, а точка — обычный
 * `View` с радиусом.
 */
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Landmark } from '../scene/Landmark';
import { Chest } from '../scene/Chest';
import { HBPet } from '../HBPet';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { useTheme } from '@/hooks/useTheme';
import { fontSize, spacing } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';
import { WORLDS, worldForDay } from '@/data/worlds';

/** Высота строки одного дня. */
const ROW = 92;
/** Высота блока с сундуком наверху карты. */
const FINISH_H = 110;
/** Высота острова-вехи с подписью. */
const MILESTONE_H = 118;
/** Сколько точек рисуем между соседними узлами. */
const DOTS = 4;

/** Где узел стоит по ширине: волна влево-вправо, как тропинка. */
const OFFSETS = [0.3, 0.5, 0.7, 0.5];
const xFor = (day: number, width: number) => OFFSETS[day % OFFSETS.length]! * width;

interface Props {
  currentDay: number;
  maxDay: number;
  isAz: boolean;
  /** Тема текущего дня — подпись на карточке рядом с Бобо. */
  todayTheme: string | null;
  onPressDay: (day: number) => void;
}

/**
 * На сколько прокрутить экран от верха карты, чтобы текущий день оказался на
 * виду. Считается отдельной функцией, потому что прокручивает не карта, а
 * экран: своя прокрутка внутри чужой ломает жест.
 */
export function pathScrollOffset(currentDay: number, maxDay: number): number {
  const rowsAbove = maxDay - currentDay;
  const milestonesAbove = WORLDS.filter((w) => w.endDay > currentDay).length;
  return Math.max(0, FINISH_H + rowsAbove * ROW + milestonesAbove * MILESTONE_H - 200);
}

export function PathMap({ currentDay, maxDay, isAz, todayTheme, onPressDay }: Props) {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const { width } = useWindowDimensions();

  // Дни идут сверху вниз в обратном порядке: 30 наверху, 1 внизу.
  const days = Array.from({ length: maxDay }, (_, i) => maxDay - i);

  return (
    <View style={styles.scroll}>
      {/* Финал пути — наверху карты, туда ребёнок и поднимается */}
      <View style={styles.finish}>
        <Chest size={54} open={currentDay > maxDay} />
        <Text variant="caption" tone="secondary" align="center">
          {isAz ? `${WORLDS.length} həftə, ${maxDay} gün` : `${WORLDS.length} недели, ${maxDay} дней`}
        </Text>
      </View>

      {days.map((day) => {
        const world = worldForDay(day);
        const isLast = day === world.endDay;
        const state = day < currentDay ? 'done' : day === currentDay ? 'current' : 'locked';
        const x = xFor(day, width);
        // Точки ведут к узлу дня, который ниже по карте (day - 1).
        const xPrev = xFor(day - 1, width);

        return (
          <View key={day}>
            {isLast ? (
              <View style={styles.milestone}>
                <Landmark kind={world.landmark} size={132} locked={day >= currentDay} />
                <View style={[styles.landLabel, { backgroundColor: c.surface }]}>
                  <Text variant="caption" style={styles.landLabelText} numberOfLines={1}>
                    {isAz ? world.landmarkAz : world.landmarkRu}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={[styles.row, { height: ROW }]}>
              {/* Дорожка к предыдущему дню */}
              {day > 1
                ? Array.from({ length: DOTS }, (_, k) => {
                    const p = (k + 1) / (DOTS + 1);
                    return (
                      <View
                        key={k}
                        style={[
                          styles.dot,
                          {
                            left: x + (xPrev - x) * p - 3,
                            top: 44 + (ROW - 44) * p,
                            backgroundColor: day <= currentDay ? c.white : c.borderStrong,
                          },
                        ]}
                      />
                    );
                  })
                : null}

              <Pressable
                style={[styles.node, { left: x - 28 }]}
                disabled={state === 'locked'}
                onPress={() => onPressDay(day)}
                accessibilityRole="button"
                accessibilityLabel={isAz ? `Gün ${day}` : `День ${day}`}
              >
                <View
                  style={[
                    styles.badge,
                    state === 'done' && { backgroundColor: c.success, borderColor: c.white },
                    state === 'current' && { backgroundColor: c.gold, borderColor: c.white },
                    state === 'locked' && { backgroundColor: c.bgDeep, borderColor: c.surface },
                  ]}
                >
                  {state === 'done' ? <Icon name="check" size={24} color={c.white} strokeWidth={3} /> : null}
                  {state === 'current' ? <Text style={styles.dayNum}>{day}</Text> : null}
                  {state === 'locked' ? <Icon name="lock" size={20} color={c.textMuted} /> : null}
                </View>
              </Pressable>

              {/* Бобо и подпись стоят у текущего дня */}
              {state === 'current' ? (
                <>
                  <View style={[styles.pet, { left: Math.max(4, x - 96) }]}>
                    <HBPet size={64} mood="happy" still />
                  </View>
                  <View style={[styles.tip, { left: Math.min(width - 158, x + 40), backgroundColor: c.surface }]}>
                    <Text variant="bodyBold" numberOfLines={1}>{todayTheme ?? (isAz ? 'Bugünkü dərs' : 'Урок дня')}</Text>
                    <Text variant="caption" tone="secondary">
                      {isAz ? `Gün ${day}` : `День ${day}`}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  // Дни уже отданы в обратном порядке (30 сверху, 1 снизу) — разворачивать
  // контейнер не нужно.
  scroll: { paddingTop: spacing[2] },
  row: { position: 'relative' },
  dot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, opacity: 0.85 },
  node: { position: 'absolute', top: 12, width: 56, alignItems: 'center' },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: { fontFamily: t.font.display, fontSize: fontSize.xl, color: '#5A3C00' },
  pet: { position: 'absolute', top: 6 },
  tip: {
    position: 'absolute',
    top: 16,
    width: 146,
    borderRadius: 18,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  milestone: { alignItems: 'center', paddingVertical: spacing[2] },
  landLabel: {
    marginTop: -10,
    borderRadius: 14,
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
  },
  landLabelText: { fontFamily: t.font.displaySemi },
  finish: { alignItems: 'center', gap: spacing[2], paddingBottom: spacing[4] },
}));
