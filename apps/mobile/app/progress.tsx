/**
 * Progress tab — stats, quick links to streak + word album, review CTA.
 * Honeybear redesign: HBPet mascot, clay cards, peach/sage palette.
 */

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabs, BottomTabsSpacer } from '@/components/BottomTabs';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { HBIconBox } from '@/components/HBIconBox';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { getLesson, STATIC_MAX_DAY } from '@/data/lessons';
import { useSettings } from '@/store/settings';
import { useAccent } from '@/hooks/useAccent';
import { useCompanionName } from '@/utils/companion';
import { fontFamily, fontSize, radius, shadow, spacing } from '@/theme';
import { byMode, makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

// Recent word preview — last N unique words
const PREVIEW_COUNT = 12;

const WORD_PALETTE_BY_MODE = byMode<{ bg: string; text: string }[]>((t) => ([
  { bg: t.c.tints.primary, text: t.c.primary },
  { bg: t.c.tints.sage, text: t.c.accent },
  { bg: t.c.tints.butter, text: t.c.butterDeep },
  { bg: t.c.englishLight, text: t.c.english },
  { bg: t.c.tints.berry, text: t.c.berryDeep },
  { bg: t.c.tints.english, text: t.c.english },
]));

export default function ProgressScreen() {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const WORD_PALETTE = WORD_PALETTE_BY_MODE[uiMode];
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const storedHue = useSettings((s) => s.petHue);
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const currentDay = useSettings((s) => s.currentDay);
  const totalStars = useSettings((s) => s.totalStars);
  const streak = useSettings((s) => s.streak);
  const isAz = lang === 'az';
  const bot = useCompanionName();

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4] }]}
      >

        {/* ── HEADER ── */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <View style={[styles.petHalo, { backgroundColor: accent.soft }]}>
            <HBPet size={72} hue={storedHue} mood={mood} />
          </View>
          <Text style={styles.headerTitle}>
            {isAz ? 'Tərəqqi' : 'Прогресс'}
          </Text>
          <Text style={styles.headerSub}>
            {streak >= 3
              ? (isAz ? `Möhtəşəmsən, ${childName}!` : `Молодец, ${childName}!`)
              : (isAz ? `Hər gün gəl, ${childName}!` : `Приходи каждый день, ${childName}!`)}
          </Text>
        </Animated.View>

        {/* ── STAT GRID ── */}
        <Animated.View entering={FadeInUp.duration(500).delay(100)} style={styles.statsGrid}>
          {/* Streak */}
          <HBCard
            depth="md"
            ringColor={streak >= 3 ? accent.bottom : undefined}
            style={[styles.statCard, styles.statCardWide]}
          >
            <Icon name="flame" size={26} color={c.primaryDeep} fill={c.butter} strokeWidth={2} />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>
              {isAz ? 'gün ardıcıl' : 'дней подряд'}
            </Text>
          </HBCard>

          {/* Stars */}
          <HBCard depth="sm" style={styles.statCard}>
            <Icon name="star" size={26} color={c.butterDeep} fill={c.butter} strokeWidth={2} />
            <Text style={styles.statValue}>{totalStars}</Text>
            <Text style={styles.statLabel}>
              {isAz ? 'ulduz' : 'звёзд'}
            </Text>
          </HBCard>

          {/* Words */}
          <HBCard depth="sm" style={styles.statCard}>
            <Icon name="book-open" size={26} color={c.accentDeep} strokeWidth={2} />
            <Text style={styles.statValue}>{uniqueWords.length}</Text>
            <Text style={styles.statLabel}>
              {isAz ? 'söz' : 'слов'}
            </Text>
          </HBCard>

          {/* Lessons */}
          <HBCard depth="sm" style={[styles.statCard, styles.statCardWide]}>
            <Icon name="calendar" size={26} color={accent.ink} strokeWidth={2} />
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
              <HBIconBox icon="flame" tint="primary" size={44} />
              <Text style={styles.quickTitle}>
                {isAz ? 'Seriya' : 'Серия'}
              </Text>
              <Text style={styles.quickSub}>
                {isAz ? 'Təqvim' : 'Календарь'}
              </Text>
              <View style={styles.quickArrow}>
                <Icon name="chevron-right" size={18} color={c.inkSoft} />
              </View>
            </HBCard>
          </Pressable>

          {/* Word album */}
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/album' as any)}>
            <HBCard depth="sm" style={styles.quickCard}>
              <HBIconBox icon="book-open" tint="sage" size={44} />
              <Text style={styles.quickTitle}>
                {isAz ? 'Sözlər' : 'Слова'}
              </Text>
              <Text style={styles.quickSub}>
                {isAz ? 'Albom' : 'Альбом'}
              </Text>
              <View style={styles.quickArrow}>
                <Icon name="chevron-right" size={18} color={c.inkSoft} />
              </View>
            </HBCard>
          </Pressable>
        </Animated.View>

        {/* ── COURSE PROGRESS (moved from home: the path is progress, not today's action) ── */}
        {currentDay <= STATIC_MAX_DAY && (
          <Animated.View entering={FadeInUp.duration(450).delay(195)}>
            <HBCard depth="sm" style={styles.courseCard}>
              <View style={styles.courseHead}>
                <Text variant="bodyBold">{isAz ? 'Kurs' : 'Курс'}</Text>
                <Text variant="caption" tone="secondary">
                  {isAz ? `Gün ${currentDay} / ${STATIC_MAX_DAY}` : `День ${currentDay} из ${STATIC_MAX_DAY}`}
                </Text>
              </View>
              <View style={styles.courseTrack}>
                <View style={[styles.courseFill, { width: `${Math.round(((currentDay - 1) / STATIC_MAX_DAY) * 100)}%` }]} />
              </View>
            </HBCard>
          </Animated.View>
        )}

        {/* ── MEMORY LINK (moved from home) ── */}
        <Animated.View entering={FadeInUp.duration(450).delay(205)}>
          <Pressable onPress={() => router.push('/memory' as never)} accessibilityRole="button">
            <HBCard depth="sm" style={styles.reviewCard}>
              <HBIconBox size={48} icon="brain" tint="primary" style={{ flexShrink: 0 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewTitle}>
                  {isAz ? `${bot} nəyi xatırlayır` : `Что помнит ${bot}`}
                </Text>
                <Text style={styles.reviewSub}>
                  {isAz ? 'Söhbətlərdən yadda qalanlar' : 'Что запомнилось из разговоров'}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color={c.inkSoft} />
            </HBCard>
          </Pressable>
        </Animated.View>

        {/* ── ACHIEVEMENTS LINK ── */}
        <Animated.View entering={FadeInUp.duration(450).delay(210)}>
          <Pressable onPress={() => router.push('/achievements' as any)}>
            <HBCard depth="sm" style={styles.reviewCard}>
              <HBIconBox size={48} icon="trophy" tint="butter" style={{ flexShrink: 0 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewTitle}>
                  {isAz ? 'Nailiyyətlər' : 'Достижения'}
                </Text>
                <Text style={styles.reviewSub}>
                  {isAz ? 'Sənin medalların və mükafatların' : 'Твои медали и награды'}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color={c.inkSoft} />
            </HBCard>
          </Pressable>
        </Animated.View>

        {/* ── REVIEW CTA ── */}
        {lessonsCompleted > 0 && (
          <Animated.View entering={FadeInUp.duration(450).delay(240)}>
            <Pressable onPress={() => router.push('/review' as any)}>
              <HBCard depth="sm" style={styles.reviewCard}>
                <HBIconBox size={48} icon="repeat" tint="sage" style={{ flexShrink: 0 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewTitle}>
                    {isAz ? 'Səhvləri təkrarla' : 'Повторить ошибки'}
                  </Text>
                  <Text style={styles.reviewSub}>
                    {isAz ? 'Çətin sözləri yenidən yoxla' : 'Закрепи слова, которые путал'}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={c.inkSoft} />
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
                  <View style={[styles.wordPill, { backgroundColor: c.bgDeep }]}>
                    <Text style={[styles.wordPillText, { color: c.inkSoft }]}>
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

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[6],
    gap: spacing[4],
  },

  // Header
  header: { alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  petHalo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: t.c.primarySoft,
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
    color: t.c.ink,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: t.c.inkSoft,
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
  statValue: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['4xl'],
    color: t.c.ink,
    letterSpacing: -1,
    lineHeight: 40,
  },
  statLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: t.c.inkSoft,
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
  quickTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: t.c.ink,
  },
  quickSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: t.c.inkSoft,
  },
  quickArrow: { alignSelf: 'flex-end' },

  // Course progress
  courseCard: { gap: spacing[2] },
  courseHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  courseTrack: { height: 8, borderRadius: radius.full, backgroundColor: t.c.bgDeep, overflow: 'hidden' },
  courseFill: { height: '100%', borderRadius: radius.full, backgroundColor: t.c.primary },

  // Review CTA
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  reviewTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: t.c.ink,
  },
  reviewSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: t.c.inkSoft,
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
    color: t.c.ink,
  },
  wordsShowAll: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: t.c.primary,
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
    color: t.c.ink,
    lineHeight: 20,
  },
}));
