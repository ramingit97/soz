/**
 * Honeybear · Achievements / Badges.
 *
 * Hero card with most-recent badge + delta points.
 * Filter chips: All / Earned / Soon / Locked.
 * 3-column grid of badge tiles (earned = colored circle, locked = dashed).
 * Bottom: progress to next badge.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';

import { BottomTabs, BottomTabsSpacer } from '@/components/BottomTabs';
import { DieCutBadge } from '@/components/DieCutBadge';
import { HBBackButton } from '@/components/HBBackButton';
import { HBCard } from '@/components/HBCard';
import { PaperBackground } from '@/components/PaperBackground';
import { PopNumber } from '@/components/PopNumber';
import { StarParticle } from '@/components/StarParticle';
import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { playSfx } from '@/services/sfx';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing, tints } from '@/theme';

type Filter = 'all' | 'earned' | 'locked';

interface BadgeStats { totalStars: number; streak: number; currentDay: number }

interface Badge {
  id: string;
  emoji: string;
  labelRu: string;
  labelAz: string;
  hint?: string;
  color: string;
  /** Human-readable unlock requirement (shown on the tile + in the detail modal). */
  reqRu: string;
  reqAz: string;
  /** Real unlock predicate — the single source of truth for "earned". */
  check: (s: BadgeStats) => boolean;
  /** Progress toward unlock, 0..1 — powers the "closest badge" nudge. */
  progress: (s: BadgeStats) => number;
}

const pct = (have: number, need: number) => Math.max(0, Math.min(1, have / need));

const ALL_BADGES: Badge[] = [
  { id: 'first', emoji: '🏆', labelRu: 'Первый урок', labelAz: 'İlk dərs', color: colors.butter,
    reqRu: 'Заверши первый урок', reqAz: 'İlk dərsi bitir',
    check: (s) => s.currentDay > 1, progress: (s) => pct(s.currentDay - 1, 1) },
  { id: 'flame7', emoji: '🔥', labelRu: 'Огонёк', labelAz: 'Alov', hint: '7 дней', color: colors.berry,
    reqRu: 'Стрик 7 дней', reqAz: '7 günlük seriya',
    check: (s) => s.streak >= 7, progress: (s) => pct(s.streak, 7) },
  { id: 'food', emoji: '🍎', labelRu: 'Гурман', labelAz: 'Qida bilici', hint: '30 звёзд', color: '#E58A66',
    reqRu: 'Собери 30 звёзд', reqAz: '30 ulduz topla',
    check: (s) => s.totalStars >= 30, progress: (s) => pct(s.totalStars, 30) },
  { id: 'family', emoji: '👨‍👩‍👧', labelRu: 'Семья', labelAz: 'Ailə', hint: '5 дней', color: colors.accent,
    reqRu: 'Пройди 5 дней', reqAz: '5 gün keç',
    check: (s) => s.currentDay > 5, progress: (s) => pct(s.currentDay - 1, 5) },
  { id: 'colors', emoji: '🎨', labelRu: 'Художник', labelAz: 'Rəssam', hint: '7 дней', color: '#9C7EE6',
    reqRu: 'Пройди 7 дней', reqAz: '7 gün keç',
    check: (s) => s.currentDay > 7, progress: (s) => pct(s.currentDay - 1, 7) },
  { id: 'bee', emoji: '🐝', labelRu: 'Пчёлка', labelAz: 'Arıcıq', hint: '10 уроков', color: colors.butter,
    reqRu: 'Пройди 10 дней', reqAz: '10 gün keç',
    check: (s) => s.currentDay > 10, progress: (s) => pct(s.currentDay - 1, 10) },
  { id: 'magic', emoji: '🪄', labelRu: 'Магия', labelAz: 'Sehr', hint: '14 дней', color: '#9C7EE6',
    reqRu: 'Стрик 14 дней', reqAz: '14 günlük seriya',
    check: (s) => s.streak >= 14, progress: (s) => pct(s.streak, 14) },
  { id: 'climb', emoji: '🏔', labelRu: 'Покоритель', labelAz: 'Fəth edən', hint: '15 дней', color: colors.accent,
    reqRu: 'Пройди 15 дней', reqAz: '15 gün keç',
    check: (s) => s.currentDay > 15, progress: (s) => pct(s.currentDay - 1, 15) },
  { id: 'travel', emoji: '🌍', labelRu: 'Путешеств.', labelAz: 'Səyahətçi', hint: '20 дней', color: colors.berry,
    reqRu: 'Пройди 20 дней', reqAz: '20 gün keç',
    check: (s) => s.currentDay > 20, progress: (s) => pct(s.currentDay - 1, 20) },
  { id: 'animal', emoji: '🦊', labelRu: 'Друг зверей', labelAz: 'Heyvan dostu', hint: '25 дней', color: '#E58A66',
    reqRu: 'Пройди 25 дней', reqAz: '25 gün keç',
    check: (s) => s.currentDay > 25, progress: (s) => pct(s.currentDay - 1, 25) },
  { id: 'stars50', emoji: '⭐', labelRu: '50 звёзд', labelAz: '50 ulduz', hint: '50 звёзд', color: colors.butter,
    reqRu: 'Собери 50 звёзд', reqAz: '50 ulduz topla',
    check: (s) => s.totalStars >= 50, progress: (s) => pct(s.totalStars, 50) },
  { id: 'sharp', emoji: '🎯', labelRu: 'Мастер', labelAz: 'Usta', hint: '100 звёзд', color: colors.berry,
    reqRu: 'Собери 100 звёзд', reqAz: '100 ulduz topla',
    check: (s) => s.totalStars >= 100, progress: (s) => pct(s.totalStars, 100) },
];

export default function AchievementsScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const isAz = lang === 'az';
  const totalStars = useSettings((s) => s.totalStars);
  const streak = useSettings((s) => s.streak);
  const currentDay = useSettings((s) => s.currentDay);
  const accent = useAccent();

  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<(Badge & { earned: boolean }) | null>(null);

  const bstats: BadgeStats = { totalStars, streak, currentDay };

  const badges = ALL_BADGES.map((b) => ({ ...b, earned: b.check(bstats) }));
  const earnedCount = badges.filter((b) => b.earned).length;
  const total = badges.length;

  const filtered = badges.filter((b) => {
    if (filter === 'all') return true;
    if (filter === 'earned') return b.earned;
    return !b.earned;
  });

  // Hero = the last badge earned (the most advanced one), or the first badge as
  // a preview when nothing is earned yet.
  const earnedBadges = badges.filter((b) => b.earned);
  const recent = earnedBadges.length ? earnedBadges[earnedBadges.length - 1]! : badges[0]!;

  // "Closest" locked badge — the one with the most progress toward unlocking.
  const nextBadge = badges
    .filter((b) => !b.earned)
    .sort((a, b) => b.progress(bstats) - a.progress(bstats))[0];

  const FILTERS: { id: Filter; labelRu: string; labelAz: string; n: number }[] = [
    { id: 'all', labelRu: 'Все', labelAz: 'Hamısı', n: total },
    { id: 'earned', labelRu: 'Открыто', labelAz: 'Açıq', n: earnedCount },
    { id: 'locked', labelRu: 'Заблок.', labelAz: 'Qapalı', n: total - earnedCount },
  ];

  return (
    <PaperBackground>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.topBar}>
          <HBBackButton inline />
          <Text style={styles.title}>
            {isAz ? 'Mənim nişanlarım' : 'Мои значки'}
          </Text>
          <View style={[styles.countChip, shadow.sm]}>
            <PopNumber value={`${earnedCount} / ${total}`} style={styles.countText} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(500).delay(80)}>
          <Pressable onPress={() => setSelected(recent)}>
            <HBCard style={styles.heroCard} depth="deep" bg={tints.butter}>
              <DieCutBadge size={64} tilt={-6} edge={3.5} bg={recent.earned ? colors.card : colors.bgDeep}>
                <Text style={{ fontSize: 32, opacity: recent.earned ? 1 : 0.5 }}>
                  {recent.earned ? recent.emoji : '🔒'}
                </Text>
              </DieCutBadge>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroKicker}>
                  {recent.earned
                    ? (isAz ? 'SON NİŞAN' : 'ПОСЛЕДНИЙ ЗНАЧОК')
                    : (isAz ? 'TEZLİKLƏ AÇILACAQ' : 'СКОРО ОТКРОЕШЬ')}
                </Text>
                <Text style={styles.heroLabel}>{isAz ? recent.labelAz : recent.labelRu}</Text>
                <Text style={styles.heroHint}>{isAz ? recent.reqAz : recent.reqRu}</Text>
              </View>
              <View style={[styles.deltaBadge, recent.earned && { backgroundColor: colors.accent }]}>
                <Text style={styles.deltaText}>{recent.earned ? '✓' : '🔒'}</Text>
              </View>
            </HBCard>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(400).delay(120)} style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[
                styles.filterChip,
                filter === f.id && styles.filterChipActive,
                shadow.sm,
              ]}
            >
              <Text style={[styles.filterText, filter === f.id && { color: colors.white }]}>
                {isAz ? f.labelAz : f.labelRu}
              </Text>
              <Text style={[styles.filterCount, filter === f.id && { color: 'rgba(255,255,255,0.85)' }]}>
                {f.n}
              </Text>
            </Pressable>
          ))}
        </Animated.View>

        <View style={styles.grid}>
          {filtered.map((b, i) => (
            <Animated.View
              key={b.id}
              entering={FadeInUp.duration(300).delay(i * 30)}
              style={styles.tileWrap}
            >
              <Pressable
                onPress={() => {
                  playSfx(b.earned ? 'success' : 'tick', b.earned ? 0.6 : 0.4);
                  Haptics.selectionAsync().catch(() => {});
                  setSelected(b);
                }}
                style={({ pressed }) => [
                  styles.tile,
                  b.earned ? styles.tileEarned : styles.tileLocked,
                  b.earned && shadow.sm,
                  pressed && { transform: [{ scale: 0.95 }] },
                ]}
              >
                {b.earned ? (
                  <DieCutBadge size={44} tilt={i % 2 === 0 ? -5 : 5} edge={2.5} bg={b.color} delay={i * 30}>
                    <Text style={{ fontSize: 22 }}>{b.emoji}</Text>
                  </DieCutBadge>
                ) : (
                  <View style={[styles.tileBadge, { backgroundColor: colors.bgDeep }]}>
                    <Text style={{ fontSize: 22, opacity: 0.5 }}>🔒</Text>
                  </View>
                )}
                <Text style={[styles.tileLabel, !b.earned && { opacity: 0.6 }]}>
                  {isAz ? b.labelAz : b.labelRu}
                </Text>
                {b.hint && <Text style={[styles.tileHint, !b.earned && { opacity: 0.7 }]}>{b.hint}</Text>}
              </Pressable>
            </Animated.View>
          ))}
        </View>

        {nextBadge ? (
          <Animated.View entering={FadeInUp.duration(400).delay(200)}>
            <HBCard style={styles.progressCard} depth="sm">
              <View style={styles.progressIcon}>
                <Text style={{ fontSize: 18 }}>{nextBadge.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.progressLabel}>
                  {isAz
                    ? `Növbəti nişan: «${nextBadge.labelAz}» — ${nextBadge.reqAz}`
                    : `Следующий значок: «${nextBadge.labelRu}» — ${nextBadge.reqRu}`}
                </Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, nextBadge.progress(bstats) * 100)}%`, backgroundColor: accent.bottom }]} />
                </View>
              </View>
            </HBCard>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInUp.duration(400).delay(200)}>
            <HBCard style={styles.progressCard} depth="sm">
              <View style={styles.progressIcon}>
                <Text style={{ fontSize: 18 }}>🎉</Text>
              </View>
              <Text style={[styles.progressLabel, { flex: 1 }]}>
                {isAz ? 'Bütün nişanlar açıldı!' : 'Все значки открыты!'}
              </Text>
            </HBCard>
          </Animated.View>
        )}

        {/* Badge detail modal — condition + earned/locked state */}
        <BadgeModal badge={selected} isAz={isAz} onClose={() => setSelected(null)} />

        <BottomTabsSpacer />
      </ScrollView>

      <BottomTabs />
    </PaperBackground>
  );
}

function BadgeModal({ badge, isAz, onClose }: {
  badge: (Badge & { earned: boolean }) | null;
  isAz: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={!!badge} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modal.backdrop} onPress={onClose}>
        {badge ? (
          <Animated.View entering={ZoomIn.duration(320).springify()} style={modal.card}>
            {/* Celebratory star-burst behind the badge — earned only */}
            {badge.earned ? (
              <View pointerEvents="none" style={modal.burst}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <StarParticle key={i} x={30 + i * 24} y={30} delay={i * 90} />
                ))}
              </View>
            ) : null}
            <DieCutBadge size={96} tilt={-4} edge={4} bg={badge.earned ? badge.color : colors.bgDeep}>
              <Text style={{ fontSize: 52, opacity: badge.earned ? 1 : 0.5 }}>
                {badge.earned ? badge.emoji : '🔒'}
              </Text>
            </DieCutBadge>
            <Text style={modal.title}>{isAz ? badge.labelAz : badge.labelRu}</Text>
            <View style={[modal.statusPill, { backgroundColor: badge.earned ? tints.sage : colors.bgDeep }]}>
              <Text style={[modal.statusText, { color: badge.earned ? colors.accent : colors.inkSoft }]}>
                {badge.earned
                  ? (isAz ? 'Açıldı ✓' : 'Открыто ✓')
                  : (isAz ? 'Hələ qapalı' : 'Ещё закрыто')}
              </Text>
            </View>
            <Text style={modal.req}>{isAz ? badge.reqAz : badge.reqRu}</Text>
            <Pressable onPress={onClose} style={modal.closeBtn}>
              <Text style={modal.closeText}>{isAz ? 'Bağla' : 'Закрыть'}</Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const modal = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(60, 49, 33, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[5],
    alignItems: 'center',
    gap: spacing[3],
    width: '100%',
    maxWidth: 320,
    ...shadow.deep,
  },
  burst: { ...StyleSheet.absoluteFillObject, alignItems: 'center' },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
  },
  statusPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
  },
  statusText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xs,
  },
  req: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  closeBtn: {
    marginTop: spacing[2],
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderBottomWidth: 3,
    borderBottomColor: colors.primaryDeep,
  },
  closeText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.sm,
    color: colors.white,
  },
});

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[12],
    gap: spacing[3],
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  countChip: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  countText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 11,
    color: colors.inkSoft,
  },

  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  heroBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  heroKicker: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 10,
    color: colors.inkSoft,
    letterSpacing: 0.8,
  },
  heroLabel: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.ink,
    marginTop: 2,
  },
  heroHint: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
  },
  deltaBadge: {
    backgroundColor: colors.ink,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  deltaText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBlack,
    fontSize: 11,
  },

  filterRow: { flexDirection: 'row', gap: 6 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.card,
    paddingHorizontal: spacing[3],
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderBottomWidth: 3,
    borderBottomColor: colors.primaryDeep,
  },
  filterText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xs,
    color: colors.ink,
  },
  filterCount: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    color: colors.inkSoft,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  tileWrap: { width: '31.5%' },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    gap: 4,
    borderRadius: radius.lg,
  },
  tileEarned: {
    backgroundColor: colors.card,
  },
  tileLocked: {
    borderWidth: 2,
    borderColor: 'rgba(124, 109, 88, 0.3)',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  tileBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0,0,0,0.12)',
  },
  tileLabel: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xs,
    color: colors.ink,
    textAlign: 'center',
  },
  tileHint: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 9,
    color: colors.inkSoft,
  },

  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
  },
  progressIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tints.butter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressLabel: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bgDeep,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
});
