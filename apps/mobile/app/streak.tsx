/**
 * Streak calendar — honeycomb-style month view.
 * Derives calendar data from existing getProgress API (no new endpoint needed).
 */

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBBackButton } from '@/components/HBBackButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { getProgress } from '@/services/api';
import { todayISO, useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

const MONTH_NAMES_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTH_NAMES_AZ = ['Yanvar','Fevral','Mart','Aprel','May','İyun','İyul','Avqust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
const DAY_HEADERS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const DAY_HEADERS_AZ = ['B.e','Ç.a','Çər','C.a','Cüm','Şnb','Baz'];

function longestStreak(doneDates: Set<string>): number {
  if (doneDates.size === 0) return 0;
  const sorted = Array.from(doneDates).sort();
  let best = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]!);
    const curr = new Date(sorted[i]!);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    cur = diff === 1 ? cur + 1 : 1;
    if (cur > best) best = cur;
  }
  return best;
}

function buildMonthGrid(year: number, month: number): (string | null)[] {
  // Returns 42-slot array (6 weeks × 7, Mon-based) of ISO date strings or null for padding
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDow = (first.getDay() + 6) % 7; // Mon=0
  const cells: (string | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= last.getDate(); d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

type DayStatus = 'done' | 'today' | 'missed' | 'future' | 'empty';

function dayStatus(date: string | null, doneDates: Set<string>, today: string): DayStatus {
  if (!date) return 'empty';
  if (date > today) return 'future';
  if (date === today) return doneDates.has(date) ? 'done' : 'today';
  return doneDates.has(date) ? 'done' : 'missed';
}

const STATUS_STYLE: Record<DayStatus, { bg: string; text: string; border?: string }> = {
  done:   { bg: colors.primary,    text: colors.white },
  today:  { bg: colors.card,       text: colors.primary, border: colors.primary },
  missed: { bg: colors.bgDeep,     text: colors.inkSoft },
  future: { bg: 'transparent',     text: colors.inkSoft },
  empty:  { bg: 'transparent',     text: 'transparent' },
};

export default function StreakScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childId = useSettings((s) => s.childId);
  const authToken = useSettings((s) => s.authToken);
  const streak = useSettings((s) => s.streak);
  const storedHue = useSettings((s) => s.petHue);
  const accent = useAccent();
  const isAz = lang === 'az';

  const today = todayISO();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [doneDates, setDoneDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId || !authToken) { setLoading(false); return; }
    getProgress(childId, authToken)
      .then((records) => {
        const dates = new Set(records.map((r) => r.completedAt.slice(0, 10)));
        setDoneDates(dates);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [childId, authToken]);

  const grid = buildMonthGrid(viewYear, viewMonth);
  const dayHeaders = isAz ? DAY_HEADERS_AZ : DAY_HEADERS_RU;
  const monthName = (isAz ? MONTH_NAMES_AZ : MONTH_NAMES_RU)[viewMonth]!;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
    const nm = viewMonth === 11 ? 0 : viewMonth + 1;
    if (ny > now.getFullYear() || (ny === now.getFullYear() && nm > now.getMonth())) return;
    setViewYear(ny); setViewMonth(nm);
  };
  const canGoNext = !(viewYear === now.getFullYear() && viewMonth === now.getMonth());

  // Stats
  const longest = longestStreak(doneDates);
  const totalDone = doneDates.size;
  const monthDone = grid.filter(d => d && doneDates.has(d)).length;

  // Streak fire emoji size based on streak length
  const fireSize = streak >= 30 ? 56 : streak >= 14 ? 48 : streak >= 7 ? 42 : 36;

  return (
    <PaperBackground variant="honey">
      {/* Top bar */}
      <View style={styles.topBar}>
        <HBBackButton inline />
        <Text style={styles.topTitle}>
          {isAz ? 'Ardıcıllıq' : 'Стрик'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Hero streak card */}
        <Animated.View entering={FadeInDown.duration(500)}>
          {streak === 0 ? (
            <HBCard depth="deep" ringColor={colors.primarySoft} style={styles.heroCard}>
              <View style={styles.heroPetWrap}>
                <HBPet size={96} hue={storedHue} mood="curious" />
              </View>
              <Text style={styles.emptyTitle}>
                {isAz ? 'Zənciri başla! 🔥' : 'Начни цепочку! 🔥'}
              </Text>
              <Text style={styles.emptyBody}>
                {isAz
                  ? 'Hər gün dərs keç — Hani sənin seriyani izləyir'
                  : 'Проходи урок каждый день — Хани следит за твоей серией'}
              </Text>
              <View style={styles.emptyExamples}>
                {(['1 gün → 🌱', '7 gün → 🔥', '30 gün → 🏆'] as const).map((ex) => (
                  <View key={ex} style={styles.examplePill}>
                    <Text style={styles.exampleText}>{ex}</Text>
                  </View>
                ))}
              </View>
            </HBCard>
          ) : (
            <HBCard depth="deep" ringColor={accent.bottom} style={styles.heroCard}>
              <View style={styles.heroPetWrap}>
                <HBPet size={80} hue={storedHue} mood="happy" />
              </View>
              <Text style={{ fontSize: fireSize, textAlign: 'center' }}>🔥</Text>
              <Text style={styles.streakNumber}>{streak}</Text>
              <Text style={styles.streakLabel}>
                {isAz ? 'gün ardıcıl' : 'дней подряд'}
              </Text>
            </HBCard>
          )}
        </Animated.View>

        {/* Stat row — only show when there's something to show */}
        {totalDone > 0 && (
          <Animated.View entering={FadeInUp.duration(450).delay(100)} style={styles.statRow}>
            <HBCard depth="sm" style={styles.statCard}>
              <Text style={styles.statEmoji}>🏆</Text>
              <Text style={styles.statValue}>{longest}</Text>
              <Text style={styles.statLabel}>
                {isAz ? 'ən yaxşı' : 'рекорд'}
              </Text>
            </HBCard>
            <HBCard depth="sm" style={styles.statCard}>
              <Text style={styles.statEmoji}>📅</Text>
              <Text style={styles.statValue}>{totalDone}</Text>
              <Text style={styles.statLabel}>
                {isAz ? 'cəmi gün' : 'всего дней'}
              </Text>
            </HBCard>
            <HBCard depth="sm" style={styles.statCard}>
              <Text style={styles.statEmoji}>✨</Text>
              <Text style={styles.statValue}>{monthDone}</Text>
              <Text style={styles.statLabel}>
                {isAz ? 'bu ay' : 'в этом мес.'}
              </Text>
            </HBCard>
          </Animated.View>
        )}

        {/* Calendar */}
        <Animated.View entering={FadeInUp.duration(450).delay(180)}>
          <HBCard depth="sm" style={styles.calCard}>
            {/* Month nav */}
            <View style={styles.monthNav}>
              <Pressable style={styles.navBtn} onPress={prevMonth}>
                <Text style={styles.navArrow}>‹</Text>
              </Pressable>
              <Text style={styles.monthTitle}>{monthName} {viewYear}</Text>
              <Pressable style={[styles.navBtn, !canGoNext && { opacity: 0.3 }]} onPress={nextMonth} disabled={!canGoNext}>
                <Text style={styles.navArrow}>›</Text>
              </Pressable>
            </View>

            {/* Day headers */}
            <View style={styles.weekRow}>
              {dayHeaders.map((h) => (
                <Text key={h} style={styles.dayHeader}>{h}</Text>
              ))}
            </View>

            {/* Grid */}
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing[6] }} />
            ) : (
              <View style={styles.grid}>
                {grid.map((date, i) => {
                  const status = dayStatus(date, doneDates, today);
                  const s = STATUS_STYLE[status];
                  const dayNum = date ? Number(date.split('-')[2]) : null;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.cell,
                        { backgroundColor: s.bg },
                        s.border && { borderWidth: 2, borderColor: s.border },
                        status === 'done' && shadow.sm,
                      ]}
                    >
                      {dayNum !== null && (
                        <Text style={[styles.cellText, { color: s.text }]}>
                          {status === 'done' ? '✓' : String(dayNum)}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Legend */}
            <View style={styles.legend}>
              <LegendItem color={colors.primary} label={isAz ? 'Tamamlandı' : 'Урок пройден'} />
              <LegendItem color={colors.bgDeep} label={isAz ? 'Buraxıldı' : 'Пропущено'} textColor={colors.inkSoft} />
              <LegendItem color="transparent" label={isAz ? 'Gözlənir' : 'Впереди'} border={colors.inkSoft} textColor={colors.inkSoft} />
            </View>
          </HBCard>
        </Animated.View>

        {/* Motivation */}
        <Animated.View entering={FadeInUp.duration(400).delay(260)}>
          <HBCard depth="sm" style={styles.motivCard}>
            <Text style={{ fontSize: 28 }}>
              {streak >= 30 ? '🏅' : streak >= 14 ? '🥇' : streak >= 7 ? '🥈' : streak >= 3 ? '🥉' : '🌱'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.motivTitle}>
                {streak >= 30
                  ? (isAz ? 'Əfsanəvi seriya!' : 'Легендарная серия!')
                  : streak >= 14
                  ? (isAz ? 'İki həftə davam edirsən!' : '2 недели без перерыва!')
                  : streak >= 7
                  ? (isAz ? 'Bir həftəlik seriya!' : 'Целая неделя!')
                  : streak >= 3
                  ? (isAz ? 'Möhkəm başlanğıc!' : 'Хорошее начало!')
                  : (isAz ? 'Zənciri başlat!' : 'Начни цепочку!')}
              </Text>
              <Text style={styles.motivSub}>
                {streak >= 7
                  ? (isAz ? 'Hani sənin səbatınla fəxr edir 🍯' : 'Хани гордится твоей настойчивостью 🍯')
                  : (isAz ? 'Hər gün bir az irəliləyirsən' : 'Каждый день — маленький шаг вперёд')}
              </Text>
            </View>
          </HBCard>
        </Animated.View>

        {/* Freeze tip */}
        <Animated.View entering={FadeIn.duration(400).delay(320)} style={styles.freezeTip}>
          <Text style={styles.freezeTipText}>
            ❄️ {isAz
              ? 'Bir günü buraxsan, narahat olma — Hani seriyanı avtomatik saxlayır'
              : 'Пропустишь день — не переживай, Хани сам сбережёт серию'}
          </Text>
        </Animated.View>

      </ScrollView>
    </PaperBackground>
  );
}

function LegendItem({ color, label, border, textColor }: {
  color: string; label: string; border?: string; textColor?: string;
}) {
  return (
    <View style={legend.row}>
      <View style={[legend.dot, { backgroundColor: color }, border && { borderWidth: 1.5, borderColor: border }]} />
      <Text style={[legend.label, textColor && { color: textColor }]}>{label}</Text>
    </View>
  );
}

const legend = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  label: { fontFamily: fontFamily.bodyMedium, fontSize: 10, color: colors.white },
});

const CELL_SIZE = 38;
const CELL_GAP = 4;

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingTop: 52, paddingBottom: spacing[2],
  },
  topTitle: { fontFamily: fontFamily.display, fontSize: fontSize.base, color: colors.ink },

  scroll: { paddingHorizontal: spacing[5], paddingTop: spacing[2], paddingBottom: spacing[8], gap: spacing[4] },

  heroCard: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[6] },
  heroPetWrap: { marginBottom: spacing[1] },
  streakNumber: {
    fontFamily: fontFamily.display,
    fontSize: 72,
    color: colors.ink,
    lineHeight: 76,
    letterSpacing: -2,
  },
  streakLabel: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.base, color: colors.inkSoft },
  streakHint: {
    fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.inkSoft,
    textAlign: 'center', marginTop: spacing[2],
  },

  statRow: { flexDirection: 'row', gap: spacing[3] },
  statCard: { flex: 1, alignItems: 'center', gap: spacing[1], paddingVertical: spacing[4] },
  statEmoji: { fontSize: 24 },
  statValue: { fontFamily: fontFamily.display, fontSize: fontSize['2xl'], color: colors.ink },
  statLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 10, color: colors.inkSoft, textAlign: 'center' },

  calCard: { gap: spacing[4] },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { padding: spacing[2] },
  navArrow: { fontFamily: fontFamily.bodyBlack, fontSize: 22, color: colors.ink },
  monthTitle: { fontFamily: fontFamily.display, fontSize: fontSize.lg, color: colors.ink },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayHeader: {
    width: CELL_SIZE, textAlign: 'center',
    fontFamily: fontFamily.bodyBold, fontSize: 10, color: colors.inkSoft,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.xs },

  legend: { flexDirection: 'row', gap: spacing[4], justifyContent: 'center', flexWrap: 'wrap' },

  motivCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  motivTitle: { fontFamily: fontFamily.display, fontSize: fontSize.base, color: colors.ink },
  motivSub: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.inkSoft, marginTop: 2 },

  freezeTip: { alignItems: 'center' },
  freezeTipText: {
    fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.inkSoft,
    textAlign: 'center', lineHeight: 18,
  },

  // Empty state (streak === 0)
  emptyTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  emptyExamples: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[2],
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  examplePill: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exampleText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
});
