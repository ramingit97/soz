import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { analyzeInterests } from '@/services/api';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing, tints } from '@/theme';
import { StepIndicator } from '@/components/StepIndicator';

// ── Known interests with display metadata ─────────────────────────────────────

interface KnownInterest {
  key: string;
  emoji: string;
  labelRu: string;
  labelAz: string;
  color: string;
  tint: string;
}

const KNOWN: KnownInterest[] = [
  { key: 'animals',  emoji: '🦁', labelRu: 'Животные',  labelAz: 'Heyvanlar',  color: '#E8945A', tint: tints.primary },
  { key: 'dinos',    emoji: '🦕', labelRu: 'Динозавры',  labelAz: 'Dinozavrlar',color: '#7AC9B5', tint: tints.sage },
  { key: 'space',    emoji: '🚀', labelRu: 'Космос',     labelAz: 'Kosmos',     color: colors.english, tint: tints.english },
  { key: 'sports',   emoji: '⚽', labelRu: 'Спорт',      labelAz: 'İdman',      color: '#4A8AFF', tint: tints.english },
  { key: 'music',    emoji: '🎵', labelRu: 'Музыка',     labelAz: 'Musiqi',     color: '#E55C73', tint: tints.berry },
  { key: 'art',      emoji: '🎨', labelRu: 'Рисование',  labelAz: 'Rəsm',       color: '#FF8C42', tint: '#FFE0CC' },
  { key: 'science',  emoji: '🔬', labelRu: 'Наука',      labelAz: 'Elm',        color: '#34C4A0', tint: '#D0F5EC' },
  { key: 'food',     emoji: '🍕', labelRu: 'Еда',        labelAz: 'Yemək',      color: '#F5D466', tint: '#FFF8D6' },
  { key: 'games',    emoji: '🎮', labelRu: 'Игры',       labelAz: 'Oyunlar',    color: colors.berry, tint: tints.berry },
];

const KNOWN_MAP = new Map(KNOWN.map((k) => [k.key, k]));

function knownFor(tag: string): KnownInterest {
  return KNOWN_MAP.get(tag) ?? {
    key: tag,
    emoji: '✨',
    labelRu: tag,
    labelAz: tag,
    color: colors.primary,
    tint: colors.primarySoft,
  };
}

// ── Tag chip ──────────────────────────────────────────────────────────────────

function TagChip({
  tag,
  isAz,
  onRemove,
}: {
  tag: string;
  isAz: boolean;
  onRemove: () => void;
}) {
  const known = knownFor(tag);
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View entering={FadeIn.duration(300)} style={aStyle}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          scale.value = withSequence(withSpring(0.88), withSpring(1));
          onRemove();
        }}
        style={[styles.chip, { backgroundColor: known.tint, borderColor: known.color }]}
      >
        <Text style={styles.chipEmoji}>{known.emoji}</Text>
        <Text style={[styles.chipLabel, { color: known.color }]}>
          {isAz ? known.labelAz : known.labelRu}
        </Text>
        <Text style={[styles.chipRemove, { color: known.color }]}>×</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Suggestion pill (add from known) ─────────────────────────────────────────

function SuggestionPill({
  item,
  isAz,
  onAdd,
}: {
  item: KnownInterest;
  isAz: boolean;
  onAdd: () => void;
}) {
  return (
    <Pressable onPress={onAdd} style={styles.suggestionPill}>
      <Text style={styles.suggestionEmoji}>{item.emoji}</Text>
      <Text style={styles.suggestionLabel}>{isAz ? item.labelAz : item.labelRu}</Text>
    </Pressable>
  );
}

// ── Thinking dots animation ───────────────────────────────────────────────────

function ThinkingDots() {
  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    const seq = (sv: { value: number }, delay: number) => {
      sv.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: delay }),
          withTiming(1, { duration: 250 }),
          withTiming(0.3, { duration: 250 }),
        ),
        -1,
        false,
      );
    };
    seq(dot1, 0);
    seq(dot2, 250);
    seq(dot3, 500);
  }, []);

  const d1Style = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const d2Style = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const d3Style = useAnimatedStyle(() => ({ opacity: dot3.value }));

  return (
    <View style={styles.dots}>
      {([d1Style, d2Style, d3Style] as const).map((s, i) => (
        <Animated.View key={i} style={[styles.dot, s]} />
      ))}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

type Phase = 'input' | 'analyzing' | 'tags';

export default function SetupInterestsScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const storedHue = useSettings((s) => s.petHue);
  const setChildInterests = useSettings((s) => s.setChildInterests);
  const isAz = lang === 'az';

  const [phase, setPhase] = useState<Phase>('input');
  const [inputText, setInputText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);

  const petScale = useSharedValue(1);
  const petStyle = useAnimatedStyle(() => ({ transform: [{ scale: petScale.value }] }));

  const removeTag = (tag: string) => {
    Haptics.selectionAsync().catch(() => {});
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const addTag = (key: string) => {
    if (tags.includes(key)) return;
    Haptics.selectionAsync().catch(() => {});
    setTags((prev) => [...prev, key]);
  };

  const handleAnalyze = async () => {
    if (inputText.trim().length < 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPhase('analyzing');

    // Animate pet
    petScale.value = withRepeat(
      withSequence(withSpring(1.1, { damping: 5 }), withSpring(1, { damping: 8 })),
      -1,
      true,
    );

    const result = await analyzeInterests(inputText.trim(), isAz ? 'az' : 'ru');

    petScale.value = withSpring(1);

    // Deduplicate + keep max 6
    const dedupedTags = [...new Set(result)].slice(0, 6);
    setTags(dedupedTags.length > 0 ? dedupedTags : ['animals', 'games']);
    setPhase('tags');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleContinue = () => {
    if (tags.length < 1) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setChildInterests(tags);
    router.push('/setup/level' as any); // выбор имени и цвета питомца переехал в pet-room
  };

  // Suggestions = known interests not already selected
  const suggestions = KNOWN.filter((k) => !tags.includes(k.key));

  return (
    <PaperBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <StepIndicator current={2} total={7} />

          {/* Header — Бобо + title */}
          <Animated.View entering={FadeInDown.duration(600).delay(60)} style={styles.header}>
            <Animated.View style={[styles.petHalo, petStyle]}>
              <HBPet
                size={72}
                hue={storedHue}
                mood={phase === 'analyzing' ? 'curious' : phase === 'tags' ? 'happy' : 'happy'}
              />
            </Animated.View>

            {phase === 'input' && (
              <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.titleBlock}>
                <Text style={styles.title}>
                  {isAz
                    ? `${childName} nəyi sevir?`
                    : `Что любит ${childName}?`}
                </Text>
                <Text style={styles.subtitle}>
                  {isAz
                    ? 'Hər şeyi yaz — Bobo özü anlayacaq'
                    : 'Пиши всё что хочешь — Бобо сам разберётся'}
                </Text>
              </Animated.View>
            )}

            {phase === 'analyzing' && (
              <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.titleBlock}>
                <Text style={styles.title}>
                  {isAz ? 'Bobo oxuyur...' : 'Бобо читает...'}
                </Text>
                <ThinkingDots />
              </Animated.View>
            )}

            {phase === 'tags' && (
              <Animated.View entering={FadeInDown.duration(400)} style={styles.titleBlock}>
                <Text style={styles.title}>
                  {isAz ? 'Bəyənərsən?' : 'Подходит?'}
                </Text>
                <Text style={styles.subtitle}>
                  {isAz
                    ? 'Lazımsızları sil, istəyənləri əlavə et'
                    : 'Убери лишнее или добавь что-то'}
                </Text>
              </Animated.View>
            )}
          </Animated.View>

          {/* INPUT PHASE */}
          {phase === 'input' && (
            <Animated.View entering={FadeInUp.duration(500).delay(160)} style={styles.inputBlock}>
              <View style={styles.inputWrap}>
                <TextInput
                  ref={inputRef}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  numberOfLines={4}
                  placeholder={
                    isAz
                      ? `Məsələn: "dinosaurları sevirəm, futbol oynayır, kedi çizir..."`
                      : `Например: "обожает динозавров, играет в футбол, рисует котиков..."`
                  }
                  placeholderTextColor={colors.inkSoft}
                  style={styles.textInput}
                  textAlignVertical="top"
                  autoFocus={false}
                  returnKeyType="default"
                />
              </View>

              <HBButton
                full
                variant={inputText.trim().length >= 2 ? 'primary' : 'ghost'}
                label={isAz ? '✨ Bobo analiz edir' : '✨ Бобо анализирует'}
                onPress={handleAnalyze}
                disabled={inputText.trim().length < 2}
              />

              {/* Divider */}
              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>{isAz ? 'ya da' : 'или'}</Text>
                <View style={styles.orLine} />
              </View>

              {/* Quick select from known */}
              <Text style={styles.quickLabel}>
                {isAz ? 'Hazır seçimlər:' : 'Готовые варианты:'}
              </Text>
              <View style={styles.knownGrid}>
                {KNOWN.map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setTags((prev) =>
                        prev.includes(item.key)
                          ? prev.filter((t) => t !== item.key)
                          : [...prev, item.key],
                      );
                    }}
                    style={[
                      styles.knownTile,
                      tags.includes(item.key) && {
                        backgroundColor: item.tint,
                        borderColor: item.color,
                      },
                    ]}
                  >
                    <Text style={styles.knownEmoji}>{item.emoji}</Text>
                    <Text
                      style={[
                        styles.knownLabel,
                        tags.includes(item.key) && { color: item.color },
                      ]}
                    >
                      {isAz ? item.labelAz : item.labelRu}
                    </Text>
                    {tags.includes(item.key) && (
                      <View style={[styles.check, { backgroundColor: item.color }]}>
                        <Text style={styles.checkText}>✓</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>

              {tags.length >= 2 && (
                <Animated.View entering={FadeInUp.duration(300)}>
                  <HBButton
                    full
                    variant="accent"
                    label={isAz ? `${tags.length} seçildi → Davam et` : `Выбрано ${tags.length} → Продолжить`}
                    onPress={handleContinue}
                  />
                </Animated.View>
              )}
            </Animated.View>
          )}

          {/* ANALYZING PHASE */}
          {phase === 'analyzing' && (
            <Animated.View
              entering={FadeIn.duration(400)}
              exiting={FadeOut.duration(300)}
              style={styles.analyzingBlock}
            >
              <Text style={styles.analyzingText}>
                {isAz
                  ? `"${inputText.slice(0, 60)}${inputText.length > 60 ? '...' : ''}"`
                  : `"${inputText.slice(0, 60)}${inputText.length > 60 ? '...' : ''}"`}
              </Text>
            </Animated.View>
          )}

          {/* TAGS RESULT PHASE */}
          {phase === 'tags' && (
            <Animated.View entering={FadeInUp.duration(500)} style={styles.tagsBlock}>
              {/* Selected tags */}
              <View style={styles.tagsWrap}>
                {tags.map((tag) => (
                  <TagChip key={tag} tag={tag} isAz={isAz} onRemove={() => removeTag(tag)} />
                ))}
              </View>

              {tags.length === 0 && (
                <Text style={styles.emptyTagsHint}>
                  {isAz ? 'Aşağıdan əlavə et' : 'Добавь из списка ниже'}
                </Text>
              )}

              {/* Suggestion row */}
              {suggestions.length > 0 && (
                <View style={styles.suggestionsSection}>
                  <Text style={styles.suggestionsLabel}>
                    {isAz ? '+ Əlavə et:' : '+ Добавить:'}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.suggestionsRow}
                  >
                    {suggestions.map((item) => (
                      <SuggestionPill
                        key={item.key}
                        item={item}
                        isAz={isAz}
                        onAdd={() => addTag(item.key)}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={styles.cta}>
                <HBButton
                  full
                  variant={tags.length >= 1 ? 'primary' : 'ghost'}
                  label={
                    tags.length >= 1
                      ? (isAz ? 'Davam et →' : 'Продолжить →')
                      : (isAz ? 'Ən azı 1 seç' : 'Выбери хотя бы 1')
                  }
                  onPress={handleContinue}
                  disabled={tags.length < 1}
                />
              </View>

              {/* Try again */}
              <Pressable onPress={() => { setPhase('input'); setTags([]); }} style={styles.retryRow}>
                <Text style={styles.retryText}>
                  {isAz ? '← Yenidən yaz' : '← Написать заново'}
                </Text>
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[10],
  },

  header: { alignItems: 'center', marginBottom: spacing[5], gap: spacing[3] },
  petHalo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
    ...shadow.sm,
  },
  titleBlock: { alignItems: 'center', gap: spacing[2] },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },

  // Input phase
  inputBlock: { gap: spacing[4] },
  inputWrap: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.10)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: 'rgba(125,90,42,0.06)',
    borderRightColor: 'rgba(125,90,42,0.06)',
    ...shadow.sm,
  },
  textInput: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.ink,
    padding: spacing[4],
    minHeight: 110,
    lineHeight: 22,
  },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  orLine: { flex: 1, height: 1, backgroundColor: colors.bgDeep },
  orText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.inkSoft },

  quickLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    letterSpacing: 0.5,
  },
  knownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  knownTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    position: 'relative',
  },
  knownEmoji: { fontSize: 16 },
  knownLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  check: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: colors.white, fontSize: scaleFont(9), fontFamily: fontFamily.bodyBlack },

  // Analyzing phase
  analyzingBlock: {
    alignItems: 'center',
    paddingVertical: spacing[8],
    gap: spacing[4],
  },
  analyzingText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    fontStyle: 'italic',
    maxWidth: 280,
    lineHeight: 20,
  },

  // Dots
  dots: { flexDirection: 'row', gap: 8, marginTop: spacing[2] },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },

  // Tags phase
  tagsBlock: { gap: spacing[5] },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    minHeight: 48,
    paddingVertical: spacing[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm },
  chipRemove: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.base, lineHeight: 18 },

  emptyTagsHint: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    paddingVertical: spacing[3],
  },

  suggestionsSection: { gap: spacing[2] },
  suggestionsLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    letterSpacing: 0.5,
  },
  suggestionsRow: { gap: spacing[2], paddingBottom: spacing[1] },
  suggestionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionEmoji: { fontSize: 14 },
  suggestionLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },

  cta: { paddingTop: spacing[2] },
  retryRow: { alignItems: 'center', paddingTop: spacing[1] },
  retryText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
});
