/**
 * Word Album — every vocabulary word the child has learned, browsable by theme.
 * Derived from completed lesson days + bundled lesson data (no new API endpoint).
 */

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { BottomTabsSpacer } from '@/components/BottomTabs';
import { HBCard } from '@/components/HBCard';
import { Icon } from '@/components/Icon';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { HBIconBox } from '@/components/HBIconBox';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { getLesson } from '@/data/lessons';
import { getProgress } from '@/services/api';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing, tints } from '@/theme';

// ─── Word card color palette (cycles through themes) ─────────────────────────

const PALETTE: { bg: string; text: string }[] = [
  { bg: tints.primary, text: colors.primary },   // peach
  { bg: tints.sage, text: colors.accent },    // sage
  { bg: tints.butter, text: colors.butterDeep },   // butter
  { bg: colors.englishLight, text: colors.english }, // sky (was lavender)
  { bg: tints.berry, text: colors.berryDeep },     // berry
  { bg: tints.english, text: '#2D63D4' },        // sky
  { bg: '#D0F5EC', text: '#1A9B7C' },        // mint
  { bg: '#FFE0CC', text: '#D4601A' },        // coral
];

interface WordEntry {
  word: string;
  day: number;
  theme: string;
  themeEmoji: string;
  paletteIdx: number;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyAlbum({ isAz, storedHue }: { isAz: boolean; storedHue: number }) {
  return (
    <Animated.View entering={FadeIn.duration(500)} style={styles.emptyWrap}>
      <HBPet size={100} hue={storedHue} mood="curious" />
      <Text style={styles.emptyTitle}>
        {isAz ? 'Sözlər hələ yoxdur' : 'Слов пока нет'}
      </Text>
      <Text style={styles.emptyBody}>
        {isAz
          ? 'İlk dərsi tamamla — sözlər burada görünəcək!'
          : 'Пройди первый урок — слова появятся здесь!'}
      </Text>
    </Animated.View>
  );
}

// ─── Word chip ────────────────────────────────────────────────────────────────

function WordChip({
  entry,
  index,
}: {
  entry: WordEntry;
  index: number;
}) {
  const p = PALETTE[entry.paletteIdx % PALETTE.length]!;
  return (
    <Animated.View entering={FadeInUp.duration(350).delay(30 * (index % 20))}>
      <View style={[styles.chip, { backgroundColor: p.bg }]}>
        <Text style={[styles.chipWord, { color: p.text }]}>{entry.word}</Text>
        <Text style={styles.chipMeta}>{entry.themeEmoji} {entry.day}</Text>
      </View>
    </Animated.View>
  );
}

/** «1 слово», «3 слова», «5 слов». */
function wordsRu(n: number): string {
  const d10 = n % 10;
  const d100 = n % 100;
  if (d10 === 1 && d100 !== 11) return 'слово';
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return 'слова';
  return 'слов';
}

// ─── Theme section ────────────────────────────────────────────────────────────

function ThemeSection({
  themeEmoji,
  theme,
  day,
  words,
  paletteIdx,
  sectionIndex,
  az,
}: {
  themeEmoji: string;
  theme: string;
  day: number;
  words: string[];
  paletteIdx: number;
  sectionIndex: number;
  az: boolean;
}) {
  const p = PALETTE[paletteIdx % PALETTE.length]!;
  return (
    <Animated.View entering={FadeInDown.duration(400).delay(60 * sectionIndex)}>
      <HBCard depth="sm" style={styles.sectionCard}>
        {/* Section header */}
        <View style={styles.sectionHeader}>
          <HBIconBox size={48} tint={p.bg} style={{ flexShrink: 0 }}>
            <Text style={styles.sectionEmoji}>{themeEmoji}</Text>
          </HBIconBox>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTheme}>{theme}</Text>
            <Text style={styles.sectionDay}>
              {az ? `Gün ${day} · ${words.length} söz` : `День ${day} · ${words.length} ${wordsRu(words.length)}`}
            </Text>
          </View>
          <View style={[styles.countBadge, { backgroundColor: p.bg }]}>
            <Text style={[styles.countBadgeText, { color: p.text }]}>{words.length}</Text>
          </View>
        </View>

        {/* Word pills */}
        <View style={styles.pillsRow}>
          {words.map((word) => (
            <View key={word} style={[styles.pill, { backgroundColor: p.bg }]}>
              <Text style={[styles.pillText, { color: p.text }]}>{word}</Text>
            </View>
          ))}
        </View>
      </HBCard>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AlbumScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const storedHue = useSettings((s) => s.petHue);
  const childId = useSettings((s) => s.childId);
  const authToken = useSettings((s) => s.authToken);
  const currentDay = useSettings((s) => s.currentDay);
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const isAz = lang === 'az';
  const accent = useAccent();

  const firstLang = learningLanguages[0] ?? 'en';

  const [loading, setLoading] = useState(true);
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'themes' | 'all'>('themes');

  useEffect(() => {
    if (!childId || !authToken) {
      // No auth — show days 1..currentDay-1 as "completed"
      const days = new Set<number>();
      for (let d = 1; d < currentDay; d++) days.add(d);
      setCompletedDays(days);
      setLoading(false);
      return;
    }
    getProgress(childId, authToken)
      .then((records) => {
        const days = new Set(records.map((r) => r.day));
        setCompletedDays(days);
      })
      .catch(() => {
        // Fallback: days before current
        const days = new Set<number>();
        for (let d = 1; d < currentDay; d++) days.add(d);
        setCompletedDays(days);
      })
      .finally(() => setLoading(false));
  }, [childId, authToken, currentDay]);

  // Build word entries from completed days
  const themeGroups = useMemo(() => {
    const groups: {
      day: number;
      theme: string;
      themeEmoji: string;
      words: string[];
      paletteIdx: number;
    }[] = [];

    const sortedDays = Array.from(completedDays).sort((a, b) => a - b);
    sortedDays.forEach((day, i) => {
      const lesson = getLesson(firstLang, day);
      if (!lesson || lesson.vocabulary.length === 0) return;
      groups.push({
        day,
        theme: lesson.theme,
        themeEmoji: lesson.themeEmoji,
        words: lesson.vocabulary,
        paletteIdx: i,
      });
    });
    return groups;
  }, [completedDays, firstLang]);

  const allWords: WordEntry[] = useMemo(() => {
    const entries: WordEntry[] = [];
    themeGroups.forEach((g) => {
      g.words.forEach((word) => {
        entries.push({
          word,
          day: g.day,
          theme: g.theme,
          themeEmoji: g.themeEmoji,
          paletteIdx: g.paletteIdx,
        });
      });
    });
    return entries;
  }, [themeGroups]);

  const filteredGroups = useMemo(() => {
    if (!query) return themeGroups;
    const q = query.toLowerCase();
    return themeGroups
      .map((g) => ({ ...g, words: g.words.filter((w) => w.toLowerCase().includes(q)) }))
      .filter((g) => g.words.length > 0 || g.theme.toLowerCase().includes(q));
  }, [themeGroups, query]);

  const filteredWords = useMemo(() => {
    if (!query) return allWords;
    const q = query.toLowerCase();
    return allWords.filter(
      (e) => e.word.toLowerCase().includes(q) || e.theme.toLowerCase().includes(q),
    );
  }, [allWords, query]);

  const totalWords = allWords.length;

  return (
    <PaperBackground>
      <ScreenHeader title={isAz ? 'Söz albomu' : 'Альбом слов'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.hero}>
          <View style={[styles.petHalo, { backgroundColor: accent.soft }]}>
            <HBPet size={72} hue={storedHue} mood={totalWords > 0 ? 'happy' : 'curious'} />
          </View>
          <Text style={styles.heroCount}>
            {totalWords}
          </Text>
          <Text style={styles.heroLabel}>
            {isAz ? 'söz öyrənildi' : 'слов изучено'}
          </Text>
          <View style={styles.heroMeta}>
            <View style={styles.heroChip}>
              <Icon name="library" size={14} color={colors.inkSoft} />
              <Text style={styles.heroChipText}>
                {themeGroups.length} {isAz ? 'mövzu' : 'тем'}
              </Text>
            </View>
            <View style={styles.heroChip}>
              <Icon name="calendar" size={14} color={colors.inkSoft} />
              <Text style={styles.heroChipText}>
                {isAz ? `Gün ${currentDay}` : `День ${currentDay}`}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Search */}
        <Animated.View entering={FadeIn.duration(400).delay(100)}>
          <View style={[styles.searchBox, shadow.sm]}>
            <Icon name="search" size={18} color={colors.inkSoft} />
            <TextInput
              style={styles.searchInput}
              placeholder={isAz ? 'Söz axtar...' : 'Поиск слов...'}
              placeholderTextColor={colors.inkSoft}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => setQuery('')}
                style={styles.clearBtn}
                accessibilityRole="button"
                accessibilityLabel={isAz ? 'Təmizlə' : 'Очистить'}
              >
                <Icon name="x" size={14} color={colors.inkSoft} strokeWidth={2.5} />
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* View toggle */}
        <Animated.View entering={FadeIn.duration(400).delay(160)} style={styles.toggle}>
          <View style={styles.toggleTrack}>
            <Pressable
              style={[styles.toggleBtn, view === 'themes' && styles.toggleBtnActive]}
              onPress={() => setView('themes')}
            >
              <Text style={[styles.toggleBtnText, view === 'themes' && styles.toggleBtnTextActive]}>
                {isAz ? 'Mövzular' : 'По темам'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, view === 'all' && styles.toggleBtnActive]}
              onPress={() => setView('all')}
            >
              <Text style={[styles.toggleBtnText, view === 'all' && styles.toggleBtnTextActive]}>
                {isAz ? 'Bütün sözlər' : 'Все слова'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Content */}
        {loading ? (
          <ActivityIndicator color={accent.bottom} style={{ marginTop: spacing[8] }} />
        ) : totalWords === 0 ? (
          <EmptyAlbum isAz={isAz} storedHue={storedHue} />
        ) : view === 'themes' ? (
          <View style={styles.sections}>
            {filteredGroups.length === 0 ? (
              <Animated.View entering={FadeIn.duration(300)} style={styles.noResults}>
                <Text style={styles.noResultsText}>
                  {isAz ? 'Heç nə tapılmadı' : 'Ничего не найдено'}
                </Text>
              </Animated.View>
            ) : (
              filteredGroups.map((g, i) => (
                <ThemeSection
                  key={g.day}
                  day={g.day}
                  theme={g.theme}
                  themeEmoji={g.themeEmoji}
                  words={g.words}
                  paletteIdx={g.paletteIdx}
                  sectionIndex={i}
                  az={isAz}
                />
              ))
            )}
          </View>
        ) : (
          <View style={styles.chipGrid}>
            {filteredWords.length === 0 ? (
              <Animated.View entering={FadeIn.duration(300)} style={styles.noResults}>
                <Text style={styles.noResultsText}>
                  {isAz ? 'Heç nə tapılmadı' : 'Ничего не найдено'}
                </Text>
              </Animated.View>
            ) : (
              filteredWords.map((entry, i) => (
                <WordChip key={`${entry.day}-${entry.word}`} entry={entry} index={i} />
              ))
            )}
          </View>
        )}

        {/* Tip card */}
        {totalWords > 0 && (
          <Animated.View entering={FadeInUp.duration(400).delay(500)} style={styles.tipCard}>
            <Text style={styles.tipEmoji}>💡</Text>
            <Text style={styles.tipText}>
              {isAz
                ? 'Hər gün yeni 5 söz öyrənirsən. Belə davam et!'
                : 'Каждый день ты учишь около 5 новых слов. Так держать!'}
            </Text>
          </Animated.View>
        )}

        <BottomTabsSpacer />
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({

  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
    gap: spacing[4],
  },

  // Hero
  hero: { alignItems: 'center', gap: spacing[1], marginBottom: spacing[2] },
  petHalo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
    ...shadow.md,
  },
  heroCount: {
    fontFamily: fontFamily.display,
    fontSize: scaleFont(52),
    color: colors.ink,
    lineHeight: 56,
    letterSpacing: -1,
  },
  heroLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
  heroMeta: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bgDeep,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  heroChipText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },

  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Toggle
  toggle: {},
  toggleTrack: {
    flexDirection: 'row',
    backgroundColor: colors.bgDeep,
    borderRadius: radius.xl,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
    ...shadow.sm,
  },
  toggleBtnText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
  toggleBtnTextActive: { color: colors.ink },

  // Theme sections
  sections: { gap: spacing[3] },
  sectionCard: { gap: spacing[3] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  sectionEmoji: { fontSize: 24 },
  sectionTheme: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  sectionDay: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
  },
  countBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.sm,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  pillText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
  },

  // All-words chip grid
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    alignItems: 'center',
    gap: 2,
  },
  chipWord: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
  },
  chipMeta: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['3xs'],
    color: colors.inkSoft,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    gap: spacing[3],
    paddingTop: spacing[8],
    paddingBottom: spacing[4],
  },
  emptyTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },

  // No results
  noResults: { paddingVertical: spacing[6], alignItems: 'center', width: '100%' },
  noResultsText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.inkSoft,
  },

  // Tip card
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing[4],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
    ...shadow.sm,
  },
  tipEmoji: { fontSize: 26 },
  tipText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    flex: 1,
    lineHeight: 20,
  },
});
