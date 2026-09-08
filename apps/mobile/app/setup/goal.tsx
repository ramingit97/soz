/**
 * Adult learner setup — name, goal, level, and the proactive opt-in, in one screen.
 *
 * Adults skip the kid-specific chain (interests / age / pet). After this:
 *   → /auth/register  (the adult is the account owner — family account model)
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { useSettings, type ChildLevel, type LearningFocus } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

interface Goal {
  key: string;
  emoji: string;
  ru: string;
  az: string;
}

const GOALS: Goal[] = [
  { key: 'travel', emoji: '✈️', ru: 'Путешествия', az: 'Səyahət' },
  { key: 'career', emoji: '💼', ru: 'Работа и карьера', az: 'İş və karyera' },
  { key: 'move', emoji: '🏡', ru: 'Переезд', az: 'Köçmək' },
  { key: 'interview', emoji: '🎤', ru: 'Собеседование', az: 'Müsahibə' },
  { key: 'family', emoji: '👨‍👩‍👧', ru: 'Общение с близкими', az: 'Yaxınlarla ünsiyyət' },
  { key: 'fun', emoji: '🎬', ru: 'Фильмы и хобби', az: 'Filmlər və hobbi' },
];

const LEVELS: { key: ChildLevel; emoji: string; ru: string; az: string }[] = [
  { key: 'beginner', emoji: '🌱', ru: 'Только начинаю', az: 'Yeni başlayıram' },
  { key: 'elementary', emoji: '🌿', ru: 'Знаю немного', az: 'Bir az bilirəm' },
  { key: 'intermediate', emoji: '🌳', ru: 'Уверенно общаюсь', az: 'Sərbəst danışıram' },
];

const FOCI: { key: LearningFocus; emoji: string; ru: string; az: string }[] = [
  { key: 'speaking', emoji: '🗣️', ru: 'Разговор', az: 'Danışıq' },
  { key: 'listening', emoji: '👂', ru: 'Аудирование', az: 'Dinləmə' },
  { key: 'words', emoji: '📚', ru: 'Слова', az: 'Sözlər' },
  { key: 'grammar', emoji: '✍️', ru: 'Грамматика', az: 'Qrammatika' },
];

export default function AdultGoalScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const setChildProfile = useSettings((s) => s.setChildProfile);
  const setGoals = useSettings((s) => s.setGoals);
  const setProactiveOptIn = useSettings((s) => s.setProactiveOptIn);
  const setLearningFocus = useSettings((s) => s.setLearningFocus);
  const isAz = lang === 'az';

  const [name, setName] = useState('');
  const [goal, setGoalKey] = useState<string | null>(null);
  const [level, setLevel] = useState<ChildLevel>('beginner');
  const [focus, setFocus] = useState<LearningFocus[]>([]);
  const [proactiveOn, setProactiveOn] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const canContinue = name.trim().length >= 2 && !!goal;

  const handleContinue = () => {
    if (!canContinue) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setChildProfile(name.trim(), 30, level); // adults: nominal age, ageBand already 'adult'
    setGoals(goal ? [goal] : []);
    setProactiveOptIn(proactiveOn);
    setLearningFocus(focus);
    router.push('/auth/register' as never);
  };

  return (
    <PaperBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
            <View style={styles.petHalo}>
              <HBPet size={56} hue={175} mood="curious" />
            </View>
            <Text style={styles.title}>{isAz ? 'Səndən bir az' : 'Немного о тебе'}</Text>
            <Text style={styles.subtitle}>
              {isAz ? 'Хани söhbəti sənin üçün uyğunlaşdıracaq' : 'Хани подстроит разговор под тебя'}
            </Text>
          </Animated.View>

          {/* Name */}
          <Animated.View entering={FadeInUp.duration(500).delay(120)}>
            <Text style={styles.label}>{isAz ? 'Adın' : 'Как тебя зовут'}</Text>
            <Pressable onPress={() => inputRef.current?.focus()} style={styles.inputBox}>
              <TextInput
                ref={inputRef}
                value={name}
                onChangeText={setName}
                placeholder={isAz ? 'Adın' : 'Имя'}
                placeholderTextColor={colors.inkSoft}
                style={styles.input}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={30}
              />
            </Pressable>
          </Animated.View>

          {/* Goal */}
          <Animated.View entering={FadeInUp.duration(500).delay(200)}>
            <Text style={styles.label}>{isAz ? 'Niyə öyrənirsən?' : 'Зачем учишь язык?'}</Text>
            <View style={styles.goalGrid}>
              {GOALS.map((g) => {
                const sel = goal === g.key;
                return (
                  <Pressable
                    key={g.key}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setGoalKey(g.key);
                    }}
                    style={[styles.goalChip, sel && styles.goalChipOn, shadow.sm]}
                  >
                    <Text style={{ fontSize: 20 }}>{g.emoji}</Text>
                    <Text style={[styles.goalText, sel && { color: colors.white }]}>
                      {isAz ? g.az : g.ru}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Level */}
          <Animated.View entering={FadeInUp.duration(500).delay(280)}>
            <Text style={styles.label}>{isAz ? 'Səviyyən' : 'Твой уровень'}</Text>
            <View style={styles.levelRow}>
              {LEVELS.map((l) => {
                const sel = level === l.key;
                return (
                  <Pressable
                    key={l.key}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setLevel(l.key);
                    }}
                    style={[styles.levelCard, sel && styles.levelCardOn, shadow.sm]}
                  >
                    <Text style={{ fontSize: 22 }}>{l.emoji}</Text>
                    <Text style={[styles.levelText, sel && { color: colors.white }]}>
                      {isAz ? l.az : l.ru}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Focus */}
          <Animated.View entering={FadeInUp.duration(500).delay(320)}>
            <Text style={styles.label}>{isAz ? 'Nəyə fokus? (istəyə görə)' : 'На что упор? (по желанию)'}</Text>
            <View style={styles.goalGrid}>
              {FOCI.map((f) => {
                const sel = focus.includes(f.key);
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setFocus((prev) => (prev.includes(f.key) ? prev.filter((x) => x !== f.key) : [...prev, f.key]));
                    }}
                    style={[styles.goalChip, sel && styles.goalChipOn, shadow.sm]}
                  >
                    <Text style={{ fontSize: 16 }}>{f.emoji}</Text>
                    <Text style={[styles.goalText, sel && { color: colors.white }]}>{isAz ? f.az : f.ru}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Proactive opt-in */}
          <Animated.View entering={FadeInUp.duration(500).delay(360)}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setProactiveOn((v) => !v);
              }}
              style={[styles.toggleRow, shadow.sm]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>
                  {isAz ? 'Хани özü yazsın' : 'Хани пишет первым'}
                </Text>
                <Text style={styles.toggleSub}>
                  {isAz
                    ? 'Keçən söhbəti xatırlayıb vaxtında soruşar. İstənilən vaxt söndür.'
                    : 'Вспомнит прошлый разговор и напишет вовремя. Выключи в любой момент.'}
                </Text>
              </View>
              <View style={[styles.switch, proactiveOn && styles.switchOn]}>
                <View style={[styles.knob, proactiveOn && styles.knobOn]} />
              </View>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(400).delay(440)} style={styles.cta}>
            <HBButton
              full
              variant="primary"
              label={isAz ? 'Davam et 🚀' : 'Продолжить 🚀'}
              onPress={handleContinue}
              disabled={!canContinue}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[6], paddingTop: 72, paddingBottom: spacing[10], gap: spacing[5] },
  header: { alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  petHalo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#E4F6F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  title: { fontFamily: fontFamily.display, fontSize: fontSize['2xl'], color: colors.ink, textAlign: 'center' },
  subtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  label: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 13,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[3],
  },
  inputBox: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderWidth: 2,
    borderColor: colors.border,
  },
  input: { fontFamily: fontFamily.bodyBlack, fontSize: 20, color: colors.ink, textAlign: 'center' },

  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.card,
    borderRadius: radius.full,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderWidth: 2,
    borderColor: colors.border,
  },
  goalChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  goalText: { fontFamily: fontFamily.bodyBold, fontSize: 13, color: colors.ink },

  levelRow: { flexDirection: 'row', gap: spacing[2] },
  levelCard: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    borderWidth: 2,
    borderColor: colors.border,
  },
  levelCardOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  levelText: { fontFamily: fontFamily.bodyBold, fontSize: 11, color: colors.ink, textAlign: 'center' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: colors.border,
  },
  toggleTitle: { fontFamily: fontFamily.bodyBlack, fontSize: 15, color: colors.ink },
  toggleSub: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.inkSoft, marginTop: 4, lineHeight: 17 },
  switch: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.border, padding: 3, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.accent },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, ...shadow.sm },
  knobOn: { alignSelf: 'flex-end' },

  cta: { marginTop: spacing[2] },
});
