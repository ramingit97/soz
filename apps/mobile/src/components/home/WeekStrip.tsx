/**
 * Неделя серии — карточка главного экрана взрослого режима (макет D).
 *
 * Семь кружков понедельник–воскресенье: закрытые дни золотые, сегодняшний
 * обведён мятным, будущие пустые. Подросток видит не абстрактное «12 дней
 * подряд», а свою неделю и то, что сегодня ещё не закрыто.
 */
import { StyleSheet, View } from 'react-native';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';
import { weekStrip } from '@/utils/weekStrip';

interface Props {
  streak: number;
  lastCompletedDate: string | null;
  /** Язык курса и уровень — подпись слева, например «Английский, B1». */
  courseLabel: string;
  isAz: boolean;
}

export function WeekStrip({ streak, lastCompletedDate, courseLabel, isAz }: Props) {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const today = new Date().toISOString().slice(0, 10);
  const days = weekStrip(streak, lastCompletedDate, today, isAz);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text variant="caption" tone="secondary">{courseLabel}</Text>
        <Text variant="caption" tone="secondary">
          {streak > 0
            ? isAz ? `${streak} gün ardıcıl` : `${streak} ${plural(streak, 'день', 'дня', 'дней')} подряд`
            : isAz ? 'Seriyanı başlat' : 'Начни серию'}
        </Text>
      </View>
      <View style={styles.row}>
        {days.map((d) => (
          <View key={d.date} style={styles.day}>
            <View
              style={[
                styles.dot,
                d.state === 'done' && { backgroundColor: c.gold },
                d.state === 'today' && { backgroundColor: 'transparent', borderWidth: 2, borderColor: c.accent },
              ]}
            >
              {d.state === 'done' ? <Icon name="check" size={16} color={c.bg} strokeWidth={3} /> : null}
              {d.state === 'today' ? <View style={[styles.today, { backgroundColor: c.accent }]} /> : null}
            </View>
            <Text variant="caption" tone="secondary" style={styles.label}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Русское склонение после числа: 1 день, 2 дня, 5 дней. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  card: {
    backgroundColor: t.c.surface,
    borderRadius: t.card.radius,
    padding: t.density.cardPad,
    gap: spacing[3],
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing[2] },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 6, width: 34 },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.c.card,
  },
  today: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 11 },
}));
