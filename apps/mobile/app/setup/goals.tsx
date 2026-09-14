/**
 * Honeybear · Goal + focus (Step 6).
 *
 * Parent picks WHY the child is learning + WHAT to emphasise. The goal frames
 * content & home copy; focus maps to lesson dials (speaking/listening → moreTalk,
 * words → moreWords via focusToLessonPrefs) and, for 13+, drives the
 * conversation-first home.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useSettings, type LearningFocus } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing } from '@/theme';
import { HBButton } from '@/components/HBButton';
import { StepIndicator } from '@/components/StepIndicator';

interface GoalOpt { key: string; emoji: string; ru: string; az: string }
const GOALS: GoalOpt[] = [
  { key: 'school', emoji: '🎓', ru: 'Школа и оценки', az: 'Məktəb və qiymətlər' },
  { key: 'future', emoji: '🚀', ru: 'Будущее и карьера', az: 'Gələcək və karyera' },
  { key: 'move', emoji: '✈️', ru: 'Переезд за границу', az: 'Xaricə köçmək' },
  { key: 'communication', emoji: '💬', ru: 'Свободное общение', az: 'Sərbəst ünsiyyət' },
  { key: 'fun', emoji: '🎮', ru: 'Для удовольствия', az: 'Əyləncə üçün' },
];

interface FocusOpt { key: LearningFocus; emoji: string; ru: string; az: string }
const FOCI: FocusOpt[] = [
  { key: 'speaking', emoji: '🗣️', ru: 'Разговор', az: 'Danışıq' },
  { key: 'listening', emoji: '👂', ru: 'Понимание на слух', az: 'Dinləmə' },
  { key: 'words', emoji: '📚', ru: 'Слова', az: 'Sözlər' },
  { key: 'grammar', emoji: '✍️', ru: 'Грамматика', az: 'Qrammatika' },
];

export default function SetupGoalsScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const setGoals = useSettings((s) => s.setGoals);
  const setLearningFocus = useSettings((s) => s.setLearningFocus);
  const storedGoals = useSettings((s) => s.goalsAll);
  const storedGoal = useSettings((s) => s.goal);
  const storedFocus = useSettings((s) => s.learningFocus);
  const isAz = lang === 'az';

  const MAX_GOALS = 2;
  const [goals, setGoalSel] = useState<string[]>(
    storedGoals.length ? storedGoals : storedGoal ? [storedGoal] : [],
  );
  const [focus, setFocus] = useState<LearningFocus[]>(storedFocus ?? []);

  // Multi-select up to MAX_GOALS; goals[0] is the PRIMARY (drives content framing).
  const toggleGoal = (k: string) => {
    Haptics.selectionAsync().catch(() => {});
    setGoalSel((prev) => {
      if (prev.includes(k)) return prev.filter((g) => g !== k);
      if (prev.length >= MAX_GOALS) return prev; // cap reached
      return [...prev, k];
    });
  };

  const toggleFocus = (k: LearningFocus) => {
    Haptics.selectionAsync().catch(() => {});
    setFocus((prev) => (prev.includes(k) ? prev.filter((f) => f !== k) : [...prev, k]));
  };

  const handleContinue = () => {
    if (goals.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setGoals(goals);
    setLearningFocus(focus);
    router.push('/setup/schedule');
  };

  return (
    <Screen gradient decoration="sunrise" scroll>
      <StepIndicator current={6} total={7} />

      <Animated.View entering={FadeInDown.duration(600).delay(100)} style={styles.header}>
        <Text style={{ fontSize: 52, textAlign: 'center' }}>🎯</Text>
        <Text variant="title" align="center" style={{ marginTop: spacing[4] }}>
          {isAz ? `${childName} niyə öyrənir?` : `Зачем ${childName} учит язык?`}
        </Text>
        <Text variant="subtitle" tone="secondary" align="center" style={{ marginTop: spacing[3] }}>
          {isAz ? 'Dərsləri buna görə kökləyəcəyik · 1–2 seç' : 'Под это настроим уроки · выбери 1–2'}
        </Text>
      </Animated.View>

      <View style={styles.cards}>
        {GOALS.map((g, i) => {
          const order = goals.indexOf(g.key);
          const sel = order !== -1;
          const isPrimary = order === 0;
          const atCap = goals.length >= MAX_GOALS;
          return (
            <Animated.View key={g.key} entering={FadeInUp.duration(420).delay(150 + i * 70)}>
              <Pressable
                onPress={() => toggleGoal(g.key)}
                disabled={!sel && atCap}
                style={[
                  styles.goalCard,
                  sel ? shadow.md : shadow.sm,
                  { borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primarySoft : colors.white },
                  !sel && atCap && { opacity: 0.5 },
                ]}
              >
                <Text style={{ fontSize: 26 }}>{g.emoji}</Text>
                <Text style={[styles.goalText, sel && { color: colors.primaryDeep }]}>{isAz ? g.az : g.ru}</Text>
                {isPrimary && (
                  <Text style={styles.primaryTag}>{isAz ? 'əsas' : 'главное'}</Text>
                )}
                <View style={[styles.radio, sel && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  {sel && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>{isAz ? 'Nəyə fokus? (istəyə görə)' : 'На что упор? (по желанию)'}</Text>
      <View style={styles.focusWrap}>
        {FOCI.map((f) => {
          const sel = focus.includes(f.key);
          return (
            <Pressable key={f.key} onPress={() => toggleFocus(f.key)} style={[styles.chip, sel && styles.chipSel]}>
              <Text style={{ fontSize: 16 }}>{f.emoji}</Text>
              <Text style={[styles.chipText, sel && { color: colors.white }]}>{isAz ? f.az : f.ru}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.cta}>
        <HBButton
          full
          variant={goals.length ? 'primary' : 'soft'}
          label={isAz ? 'Davam et' : 'Продолжить'}
          onPress={handleContinue}
          disabled={!goals.length}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing[4], marginBottom: spacing[5], paddingHorizontal: spacing[2] },
  cards: { gap: spacing[3], marginBottom: spacing[4] },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 2,
  },
  goalText: { flex: 1, fontFamily: fontFamily.bodyBlack, fontSize: scaleFont(15), color: colors.ink },
  primaryTag: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize['3xs'],
    color: colors.primaryDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    backgroundColor: colors.white,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.white },

  sectionLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.caption,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing[2],
    marginBottom: spacing[3],
  },
  focusWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[6] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadow.sm,
  },
  chipSel: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.ink },

  cta: { paddingBottom: spacing[6] },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center',
    ...shadow.glow,
  },
  btnDisabled: { backgroundColor: colors.border, shadowOpacity: 0, elevation: 0 },
  btnText: { color: colors.white, fontFamily: fontFamily.bodyBlack, fontSize: fontSize.button },
});
