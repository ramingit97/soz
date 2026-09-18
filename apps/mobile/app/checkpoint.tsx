import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBIconBox } from '@/components/HBIconBox';
import { HBPet } from '@/components/HBPet';
import { type IconName } from '@/components/Icon';
import { PaperBackground } from '@/components/PaperBackground';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { UIModeProvider } from '@/hooks/useUIMode';
import { analyzeInterests, updatePreferences, type LessonPrefs } from '@/services/api';
import { fetchFullCurriculum } from '@/services/curriculum';
import { useSettings } from '@/store/settings';
import { useCompanionName } from '@/utils/companion';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing, tints } from '@/theme';

// ── Known-interest display metadata (compact; mirrors setup/interests) ─────────

interface Known {
  key: string;
  emoji: string;
  labelRu: string;
  labelAz: string;
  color: string;
  tint: string;
}

const KNOWN: Known[] = [
  { key: 'animals', emoji: '🦁', labelRu: 'Животные', labelAz: 'Heyvanlar', color: '#E8945A', tint: tints.primary },
  { key: 'dinos', emoji: '🦕', labelRu: 'Динозавры', labelAz: 'Dinozavrlar', color: '#7AC9B5', tint: tints.sage },
  { key: 'space', emoji: '🚀', labelRu: 'Космос', labelAz: 'Kosmos', color: colors.english, tint: tints.english },
  { key: 'sports', emoji: '⚽', labelRu: 'Спорт', labelAz: 'İdman', color: '#4A8AFF', tint: tints.english },
  { key: 'music', emoji: '🎵', labelRu: 'Музыка', labelAz: 'Musiqi', color: '#E55C73', tint: tints.berry },
  { key: 'art', emoji: '🎨', labelRu: 'Рисование', labelAz: 'Rəsm', color: '#FF8C42', tint: '#FFE0CC' },
  { key: 'science', emoji: '🔬', labelRu: 'Наука', labelAz: 'Elm', color: '#34C4A0', tint: '#D0F5EC' },
  { key: 'food', emoji: '🍕', labelRu: 'Еда', labelAz: 'Yemək', color: '#F5D466', tint: '#FFF8D6' },
  { key: 'games', emoji: '🎮', labelRu: 'Игры', labelAz: 'Oyunlar', color: colors.berry, tint: tints.berry },
];
const KNOWN_MAP = new Map(KNOWN.map((k) => [k.key, k]));
function knownFor(tag: string): Known {
  return (
    KNOWN_MAP.get(tag) ?? {
      key: tag,
      emoji: '✨',
      labelRu: tag,
      labelAz: tag,
      color: colors.primary,
      tint: colors.primarySoft,
    }
  );
}

type Difficulty = 'easier' | 'neutral' | 'harder';

const MOODS = [
  { key: 'love', emoji: '😍' },
  { key: 'ok', emoji: '🙂' },
  { key: 'meh', emoji: '😕' },
] as const;
type Mood = (typeof MOODS)[number]['key'];

export default function CheckpointScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const bot = useCompanionName();
  const isAz = lang === 'az';
  const childId = useSettings((s) => s.childId);
  const token = useSettings((s) => s.authToken);
  const childName = useSettings((s) => s.childName) ?? (isAz ? 'uşaq' : 'ребёнок');
  const storedHue = useSettings((s) => s.petHue);
  const storedInterests = useSettings((s) => s.childInterests);
  const setChildInterests = useSettings((s) => s.setChildInterests);
  const learningLanguages = useSettings((s) => s.learningLanguages);

  // Child signal
  const [mood, setMood] = useState<Mood | null>(null);
  // Parent dials
  const [moreTalk, setMoreTalk] = useState(false);
  const [moreWords, setMoreWords] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('neutral');
  // Interests
  const [interests, setInterests] = useState<string[]>(storedInterests);
  const [inputText, setInputText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const tap = () => Haptics.selectionAsync().catch(() => {});

  const removeInterest = (tag: string) => {
    tap();
    setInterests((prev) => prev.filter((t) => t !== tag));
  };
  const addInterest = (tag: string) => {
    if (interests.includes(tag)) return;
    tap();
    setInterests((prev) => [...prev, tag]);
  };

  const handleAnalyze = async () => {
    if (inputText.trim().length < 2 || analyzing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAnalyzing(true);
    const result = await analyzeInterests(inputText.trim(), isAz ? 'az' : 'ru');
    setAnalyzing(false);
    if (result.length > 0) {
      setInterests((prev) => [...new Set([...prev, ...result])].slice(0, 12));
      setInputText('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  const handleSave = async () => {
    if (!childId || !token || submitting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSubmitting(true);

    const lessonPrefs: LessonPrefs = {};
    if (moreTalk) lessonPrefs.moreTalk = true;
    if (moreWords) lessonPrefs.moreWords = true;
    if (difficulty !== 'neutral') lessonPrefs.difficulty = difficulty;

    try {
      await updatePreferences(childId, { interests, lessonPrefs }, token);
      setChildInterests(interests); // keep local store in sync
      // Refresh the curriculum cache so the freshly re-skinned upcoming lessons show
      await Promise.all(
        learningLanguages.map((l) => fetchFullCurriculum(childId, l, token).catch(() => 0)),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDone(true);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setSubmitting(false);
    }
  };

  const suggestions = KNOWN.filter((k) => !interests.includes(k.key));

  // ── Success state ───────────────────────────────────────────────────────────
  if (done) {
    return (
      <UIModeProvider force="teen">
      <PaperBackground>
        <View style={styles.successWrap}>
          <Animated.View entering={FadeInDown.duration(500)} style={styles.successInner}>
            <HBPet size={96} hue={storedHue} mood="happy" />
            <Text style={styles.successTitle}>{isAz ? 'Hazırdır!' : 'Готово!'}</Text>
            <Text style={styles.successBody}>
              {isAz
                ? `${bot} növbəti dərsləri ${childName} üçün yeniləyəcək.`
                : `${bot} обновит следующие уроки под ${childName}.`}
            </Text>
            <View style={styles.successBtn}>
              <HBButton
                full
                variant="primary"
                label={isAz ? 'Qayıt' : 'Вернуться'}
                onPress={() => router.back()}
              />
            </View>
          </Animated.View>
        </View>
      </PaperBackground>
      </UIModeProvider>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    // Настройку читает и делает родитель — «взрослый» режим.
    <UIModeProvider force="teen">
    <PaperBackground>
      <ScreenHeader title={isAz ? 'Dərsləri tənzimlə' : 'Настроить уроки'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(500).delay(40)} style={styles.header}>
            <View style={styles.petHalo}>
              <HBPet size={68} hue={storedHue} mood={submitting ? 'curious' : 'happy'} />
            </View>
            <Text style={styles.title}>{isAz ? 'Həftə necə keçdi?' : 'Как прошла неделя?'}</Text>
            <Text style={styles.subtitle}>
              {isAz
                ? `${childName} üçün dərsləri tənzimlə`
                : `Настрой уроки под ${childName}`}
            </Text>
          </Animated.View>

          {/* ── Child pulse ───────────────────────────────────────────────── */}
          <Animated.View entering={FadeInUp.duration(450).delay(120)} style={styles.card}>
            <Text style={styles.cardLabel}>
              {isAz ? `${childName}-dan soruş:` : `Спроси ${childName}:`}
            </Text>
            <Text style={styles.cardQuestion}>
              {isAz ? 'Dərslər xoşuna gəldi?' : 'Тебе нравятся уроки?'}
            </Text>
            <View style={styles.moodRow}>
              {MOODS.map((m) => (
                <Pressable
                  key={m.key}
                  onPress={() => {
                    tap();
                    setMood(m.key);
                  }}
                  style={[styles.moodBtn, mood === m.key && styles.moodBtnActive]}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* ── Parent dials ──────────────────────────────────────────────── */}
          <Animated.View entering={FadeInUp.duration(450).delay(200)} style={styles.card}>
            <Text style={styles.cardLabel}>{isAz ? 'VALİDEYN TƏNZİMLƏMƏSİ' : 'НАСТРОЙКА РОДИТЕЛЯ'}</Text>

            <ToggleRow
              icon="message-circle"
              label={isAz ? 'Daha çox söhbət' : 'Больше разговоров'}
              hint={isAz ? `${bot} ilə daha çox danış` : `Больше живого общения с ${bot}`}
              value={moreTalk}
              onToggle={() => {
                tap();
                setMoreTalk((v) => !v);
              }}
            />
            <View style={styles.rowDivider} />
            <ToggleRow
              icon="book-open"
              label={isAz ? 'Daha çox söz' : 'Больше слов'}
              hint={isAz ? 'Hər dərsdə daha çox lüğət' : 'Больше новых слов в уроке'}
              value={moreWords}
              onToggle={() => {
                tap();
                setMoreWords((v) => !v);
              }}
            />
            <View style={styles.rowDivider} />

            {/* Difficulty segmented */}
            <View style={styles.diffBlock}>
              <Text style={styles.diffLabel}>{isAz ? 'Çətinlik' : 'Сложность'}</Text>
              <View style={styles.segment}>
                {([
                  { key: 'easier', ru: 'Легче', az: 'Asan' },
                  { key: 'neutral', ru: 'В самый раз', az: 'Tam yerində' },
                  { key: 'harder', ru: 'Сложнее', az: 'Çətin' },
                ] as const).map((opt) => (
                  <Pressable
                    key={opt.key}
                    onPress={() => {
                      tap();
                      setDifficulty(opt.key);
                    }}
                    style={[styles.segBtn, difficulty === opt.key && styles.segBtnActive]}
                  >
                    <Text
                      style={[
                        styles.segText,
                        difficulty === opt.key && styles.segTextActive,
                      ]}
                    >
                      {isAz ? opt.az : opt.ru}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* ── Interests ─────────────────────────────────────────────────── */}
          <Animated.View entering={FadeInUp.duration(450).delay(280)} style={styles.card}>
            <Text style={styles.cardLabel}>{isAz ? 'MARAQLAR' : 'ИНТЕРЕСЫ'}</Text>
            <Text style={styles.cardQuestion}>
              {isAz ? `${childName} nəyi sevir?` : `Что любит ${childName}?`}
            </Text>

            {/* Current interest chips */}
            <View style={styles.chipsWrap}>
              {interests.map((tag) => {
                const k = knownFor(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => removeInterest(tag)}
                    style={[styles.chip, { backgroundColor: k.tint, borderColor: k.color }]}
                  >
                    <Text style={styles.chipEmoji}>{k.emoji}</Text>
                    <Text style={[styles.chipLabel, { color: k.color }]}>
                      {isAz ? k.labelAz : k.labelRu}
                    </Text>
                    <Text style={[styles.chipRemove, { color: k.color }]}>×</Text>
                  </Pressable>
                );
              })}
              {interests.length === 0 && (
                <Text style={styles.emptyHint}>
                  {isAz ? 'Aşağıdan əlavə et' : 'Добавь из списка ниже'}
                </Text>
              )}
            </View>

            {/* Free-text → AI */}
            <View style={styles.inputRow}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder={
                  isAz ? 'Yaz: "robotları sevir..."' : 'Напиши: "полюбил роботов..."'
                }
                placeholderTextColor={colors.inkSoft}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={handleAnalyze}
              />
              <Pressable
                onPress={handleAnalyze}
                disabled={inputText.trim().length < 2 || analyzing}
                style={[
                  styles.addBtn,
                  (inputText.trim().length < 2 || analyzing) && styles.addBtnOff,
                ]}
              >
                <Text style={styles.addBtnText}>{analyzing ? '…' : '✨'}</Text>
              </Pressable>
            </View>

            {/* Quick add */}
            {suggestions.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggRow}
              >
                {suggestions.map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => addInterest(item.key)}
                    style={styles.suggPill}
                  >
                    <Text style={styles.suggEmoji}>{item.emoji}</Text>
                    <Text style={styles.suggLabel}>{isAz ? item.labelAz : item.labelRu}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Animated.View>

          {/* Save */}
          <Animated.View entering={FadeIn.duration(400).delay(360)} style={styles.saveWrap}>
            <HBButton
              full
              variant="primary"
              label={
                submitting
                  ? isAz
                    ? `${bot} dərsləri yeniləyir…`
                    : `${bot} обновляет уроки…`
                  : isAz
                    ? 'Yadda saxla'
                    : 'Сохранить'
              }
              onPress={handleSave}
              disabled={submitting}
            />
            <Pressable onPress={() => router.back()} style={styles.skipRow} disabled={submitting}>
              <Text style={styles.skipText}>{isAz ? 'İndi yox' : 'Не сейчас'}</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </PaperBackground>
    </UIModeProvider>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({
  icon,
  label,
  hint,
  value,
  onToggle,
}: {
  icon: IconName;
  label: string;
  hint: string;
  value: boolean;
  onToggle: () => void;
}) {
  const accent = useAccent();
  return (
    <Pressable
      onPress={onToggle}
      style={styles.toggleRow}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <HBIconBox icon={icon} tint={accent.soft} iconColor={accent.ink} size={40} />
      <View style={styles.toggleTextWrap}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleHint}>{hint}</Text>
      </View>
      <View style={[styles.switch, value && { backgroundColor: accent.bottom }]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[10],
    gap: spacing[4],
  },

  header: { alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] },
  petHalo: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
    ...shadow.sm,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginTop: spacing[1],
  },
  subtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing[4],
    gap: spacing[3],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.10)',
    ...shadow.sm,
  },
  cardLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    letterSpacing: 0.5,
  },
  cardQuestion: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.ink,
  },

  // Mood
  moodRow: { flexDirection: 'row', gap: spacing[3], justifyContent: 'center' },
  moodBtn: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  moodBtnActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  moodEmoji: { fontSize: 34 },

  // Toggle rows
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  toggleTextWrap: { flex: 1, gap: 2 },
  toggleLabel: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.base, color: colors.ink },
  toggleHint: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.inkSoft },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bgDeep,
    padding: 3,
    justifyContent: 'center',
  },
  knob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    ...shadow.sm,
  },
  knobOn: { alignSelf: 'flex-end' },
  rowDivider: { height: 1, backgroundColor: colors.bgDeep },

  // Difficulty segmented
  diffBlock: { gap: spacing[2] },
  diffLabel: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.base, color: colors.ink },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    padding: 3,
    gap: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segBtnActive: { backgroundColor: colors.primary, ...shadow.sm },
  segText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  segTextActive: { color: colors.white },

  // Interest chips
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], minHeight: 40 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  chipEmoji: { fontSize: 15 },
  chipLabel: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm },
  chipRemove: { fontFamily: fontFamily.bodyBlack, fontSize: scaleFont(15), lineHeight: 17 },
  emptyHint: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    paddingVertical: spacing[2],
  },

  // Free-text input
  inputRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  addBtnOff: { opacity: 0.4 },
  addBtnText: { fontSize: fontSize.xl },

  suggRow: { gap: spacing[2], paddingTop: spacing[1], paddingBottom: spacing[1] },
  suggPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggEmoji: { fontSize: 14 },
  suggLabel: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.inkSoft },

  // Save
  saveWrap: { gap: spacing[2], marginTop: spacing[2] },
  skipRow: { alignItems: 'center', paddingVertical: spacing[2] },
  skipText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.inkSoft },

  // Success
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
  successInner: { alignItems: 'center', gap: spacing[3] },
  successTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'],
    color: colors.ink,
    marginTop: spacing[2],
  },
  successBody: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  successBtn: { alignSelf: 'stretch', marginTop: spacing[4] },
});
