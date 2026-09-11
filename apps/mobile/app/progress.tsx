/**
 * Progress tab — stats, quick links to streak + word album, review CTA.
 * Honeybear redesign: HBPet mascot, clay cards, peach/sage palette.
 */

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { BottomTabs, BottomTabsSpacer } from '@/components/BottomTabs';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { HBIconBox } from '@/components/HBIconBox';
import { Text } from '@/components/Text';
import { getLesson, STATIC_MAX_DAY } from '@/data/lessons';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing, tints } from '@/theme';

// Recent word preview — last N unique words
const PREVIEW_COUNT = 12;

const WORD_PALETTE: { bg: string; text: string }[] = [
  { bg: tints.primary, text: colors.primary },
  { bg: tints.sage, text: colors.accent },
  { bg: tints.butter, text: colors.butterDeep },
  { bg: colors.englishLight, text: colors.english },
  { bg: tints.berry, text: colors.berryDeep },
  { bg: tints.english, text: colors.english },
];

export default function ProgressScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const storedHue = useSettings((s) => s.petHue);
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const currentDay = useSettings((s) => s.currentDay);
  const totalStars = useSettings((s) => s.totalStars);
  const streak = useSettings((s) => s.streak);
  const isAz = lang === 'az';

  const firstLang = learningLanguages[0] ?? 'en';

  // Collect all words from completed lessons
  const learnedWords: string[] = [];
  for (let d = 1; d < Math.min(currentDay, STATIC_MAX_DAY + 1); d++) {
    const lesson = getLesson(firstLang, d);
    if (lesson) learnedWords.push(...lesson.vocabulary);
  }
  const uniqueWords = Array.from(new Set(learnedWords));
  const previewWords = uniqueWords.slice(-PREVIEW_COUNT);
  const extraCount = uniqueWords.length - PREVIEW_COUNT;

  const lessonsCompleted = currentDay - 1;

  // Mood: happy if streak≥3, curious if streak≥1, sleepy otherwise
  const mood = streak >= 3 ? 'happy' : streak >= 1 ? 'curious' : 'sleepy';

  return (
    <PaperBackground>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── HEADER ── */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <View style={styles.petHalo}>
            <HBPet size={72} hue={storedHue} mood={mood} />
          </View>
          <Text style={styles.headerTitle}>
            {isAz ? 'Tərəqqi' : 'Прогресс'}
          </Text>
          <Text style={styles.headerSub}>
            {streak >= 3
              ? (isAz ? `Möhtəşəmsən, ${childName}! 🔥` : `Молодец, ${childName}! 🔥`)
              : (isAz ? `Hər gün gəl, ${childName}!` : `Приходи каждый день, ${childName}!`)}
          </Text>
        </Animated.View>

        {/* ── STAT GRID ── */}
        <Animated.View entering={FadeInUp.duration(500).delay(100)} style={styles.statsGrid}>
          {/* Streak */}
          <HBCard
            depth="md"
            ringColor={streak >= 3 ? colors.primary : undefined}
            style={[styles.statCard, styles.statCardWide]}
          >
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>
              {isAz ? 'gün ardıcıl' : 'дней подряд'}
            </Text>
          </HBCard>

          {/* Stars */}
          <HBCard depth="sm" style={styles.statCard}>
            <Text style={styles.statEmoji}>⭐</Text>
            <Text style={styles.statValue}>{totalStars}</Text>
            <Text style={styles.statLabel}>
              {isAz ? 'ulduz' : 'звёзд'}
            </Text>
          </HBCard>

          {/* Words */}
          <HBCard depth="sm" style={styles.statCard}>
            <Text style={styles.statEmoji}>📖</Text>
            <Text style={styles.statValue}>{uniqueWords.length}</Text>
            <Text style={styles.statLabel}>
              {isAz ? 'söz' : 'слов'}
            </Text>
          </HBCard>

          {/* Lessons */}
          <HBCard depth="sm" style={[styles.statCard, styles.statCardWide]}>
            <Text style={styles.statEmoji}>📅</Text>
            <Text style={styles.statValue}>{lessonsCompleted}</Text>
            <Text style={styles.statLabel}>
              {isAz ? 'dərs bitirdim' : 'уроков пройдено'}
            </Text>
          </HBCard>
        </Animated.View>

        {/* ── QUICK LINKS ── */}
        <Animated.View entering={FadeInUp.duration(450).delay(180)} style={styles.quickRow}>
          {/* Streak calendar */}
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/streak' as any)}>
            <HBCard depth="sm" style={styles.quickCard}>
              <View style={[styles.quickIcon, { backgroundColor: tints.primary }]}>
                <Text style={{ fontSize: 22 }}>🔥</Text>
              </View>
              <Text style={styles.quickTitle}>
                {isAz ? 'Seriya' : 'Серия'}
              </Text>
              <Text style={styles.quickSub}>
                {isAz ? 'Təqvim' : 'Календарь'}
              </Text>
              <Text style={styles.quickArrow}>›</Text>
            </HBCard>
          </Pressable>

          {/* Word album */}
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/album' as any)}>
            <HBCard depth="sm" style={styles.quickCard}>
              <View style={[styles.quickIcon, { backgroundColor: tints.sage }]}>
                <Text style={{ fontSize: 22 }}>📖</Text>
              </View>
              <Text style={styles.quickTitle}>
                {isAz ? 'Sözlər' : 'Слова'}
              </Text>
              <Text style={styles.quickSub}>
                {isAz ? 'Albom' : 'Альбом'}
              </Text>
              <Text style={styles.quickArrow}>›</Text>
            </HBCard>
          </Pressable>
        </Animated.View>

        {/* ── ACHIEVEMENTS LINK ── */}
        <Animated.View entering={FadeInUp.duration(450).delay(210)}>
          <Pressable onPress={() => router.push('/achievements' as any)}>
            <HBCard depth="sm" ringColor={colors.butter} style={styles.reviewCard}>
              <HBIconBox size={48} tint={tints.butter} style={{ flexShrink: 0 }}>
                <Text style={{ fontSize: 24 }}>🏆</Text>
              </HBIconBox>
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewTitle}>
                  {isAz ? 'Nailiyyətlər' : 'Достижения'}
                </Text>
                <Text style={styles.reviewSub}>
                  {isAz ? 'Sənin medalların və mükafatların' : 'Твои медали и награды'}
                </Text>
              </View>
              <Text style={[styles.quickArrow, { color: colors.butterDeep }]}>›</Text>
            </HBCard>
          </Pressable>
        </Animated.View>

        {/* ── REVIEW CTA ── */}
        {lessonsCompleted > 0 && (
          <Animated.View entering={FadeInUp.duration(450).delay(240)}>
            <Pressable onPress={() => router.push('/review' as any)}>
              <HBCard depth="sm" ringColor={colors.accent} style={styles.reviewCard}>
                <HBIconBox size={48} tint={tints.sage} style={{ flexShrink: 0 }}>
                  <Text style={{ fontSize: 24 }}>🔁</Text>
                </HBIconBox>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewTitle}>
                    {isAz ? 'Səhvləri təkrarla' : 'Повторить ошибки'}
                  </Text>
                  <Text style={styles.reviewSub}>
                    {isAz ? 'Çətin sözləri yenidən yoxla' : 'Закрепи слова, которые путал'}
                  </Text>
                </View>
                <Text style={[styles.quickArrow, { color: colors.accent }]}>›</Text>
              </HBCard>
            </Pressable>
          </Animated.View>
        )}

        {/* ── WORD PREVIEW ── */}
        {uniqueWords.length > 0 && (
          <Animated.View entering={FadeInUp.duration(450).delay(300)}>
            <HBCard depth="sm" style={styles.wordsCard}>
              <View style={styles.wordsSectionHeader}>
                <Text style={styles.wordsSectionTitle}>
                  {isAz ? '🔤 Son öyrənilən sözlər' : '🔤 Последние слова'}
                </Text>
                <Pressable onPress={() => router.push('/album' as any)}>
                  <Text style={styles.wordsShowAll}>
                    {isAz ? 'Hamısı ›' : 'Все ›'}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.wordPills}>
                {previewWords.map((word, i) => {
                  const p = WORD_PALETTE[i % WORD_PALETTE.length]!;
                  return (
                    <View key={word} style={[styles.wordPill, { backgroundColor: p.bg }]}>
                      <Text style={[styles.wordPillText, { color: p.text }]}>{word}</Text>
                    </View>
                  );
                })}
                {extraCount > 0 && (
                  <View style={[styles.wordPill, { backgroundColor: colors.bgDeep }]}>
                    <Text style={[styles.wordPillText, { color: colors.inkSoft }]}>
                      +{extraCount}
                    </Text>
                  </View>
                )}
              </View>
            </HBCard>
          </Animated.View>
        )}

        {/* ── ENCOURAGEMENT BUBBLE ── */}
        <Animated.View entering={FadeIn.duration(500).delay(380)} style={styles.bubbleWrap}>
          <HBPet size={64} hue={storedHue} mood={mood} />
          <HBCard depth="sm" style={styles.bubble}>
            <Text style={styles.bubbleText}>
              {streak >= 7
                ? (isAz
                    ? `${streak} gün ardıcıl! Sən qəhrəmansen! 🏆`
                    : `${streak} дней подряд! Ты герой! 🏆`)
                : streak >= 3
                ? (isAz
                    ? `Seriya ${streak} gün! Davam et! ✨`
                    : `Серия ${streak} дня! Продолжай! ✨`)
                : (isAz
                    ? `Hər gün gəl, ${childName}! Sən bacaracaqsan 💪`
                    : `Приходи каждый день, ${childName}! У тебя получится 💪`)}
            </Text>
          </HBCard>
        </Animated.View>

        <BottomTabsSpacer />
      </ScrollView>

      <BottomTabs />
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[14],
    paddingBottom: spacing[6],
    gap: spacing[4],
  },

  // Header
  header: { alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  petHalo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
    marginBottom: spacing[1],
    ...shadow.md,
  },
  headerTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[4],
  },
  statCardWide: { flexBasis: '100%' },
  statEmoji: { fontSize: 28, marginBottom: 2 },
  statValue: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['4xl'],
    color: colors.ink,
    letterSpacing: -1,
    lineHeight: 40,
  },
  statLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    textAlign: 'center',
  },

  // Quick links
  quickRow: { flexDirection: 'row', gap: spacing[3] },
  quickCard: {
    gap: spacing[1],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    flex: 1,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  quickTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  quickSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },
  quickArrow: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xl,
    color: colors.inkSoft,
    alignSelf: 'flex-end',
  },

  // Review CTA
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  reviewIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reviewTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  reviewSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
  },

  // Word preview
  wordsCard: { gap: spacing[3] },
  wordsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordsSectionTitle: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  wordsShowAll: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  wordPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  wordPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  wordPillText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
  },

  // Encouragement bubble
  bubbleWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  bubble: { flex: 1 },
  bubbleText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.ink,
    lineHeight: 20,
  },
});
