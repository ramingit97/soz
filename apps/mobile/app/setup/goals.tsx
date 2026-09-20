/**
 * Honeybear · Goal + focus (Step 6).
 *
 * Parent picks WHY the child is learning + WHAT to emphasise. The goal frames
 * content & home copy; focus maps to lesson dials (speaking/listening → moreTalk,
 * words → moreWords via focusToLessonPrefs) and, for 13+, drives the
 * conversation-first home.
 */

import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useSettings, type LearningFocus } from '@/store/settings';
import { fontFamily, fontSize, radius, scaleFont, spacing } from '@/theme';
import { HBButton } from '@/components/HBButton';
import { Icon, type IconName } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StepIndicator } from '@/components/StepIndicator';
import { useAccent } from '@/hooks/useAccent';
import { UIModeProvider } from '@/hooks/useUIMode';
import { updateChild } from '@/services/api';
import { makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

interface GoalOpt { key: string; icon: IconName; ru: string; az: string }
const GOALS: GoalOpt[] = [
  { key: 'school', icon: 'graduation-cap', ru: 'Школа и оценки', az: 'Məktəb və qiymətlər' },
  { key: 'future', icon: 'rocket', ru: 'Будущее и карьера', az: 'Gələcək və karyera' },
  { key: 'move', icon: 'plane', ru: 'Переезд за границу', az: 'Xaricə köçmək' },
  { key: 'communication', icon: 'message-circle', ru: 'Свободное общение', az: 'Sərbəst ünsiyyət' },
  { key: 'fun', icon: 'gamepad-2', ru: 'Для удовольствия', az: 'Əyləncə üçün' },
];

interface FocusOpt { key: LearningFocus; icon: IconName; ru: string; az: string }
const FOCI: FocusOpt[] = [
  { key: 'speaking', icon: 'mic', ru: 'Разговор', az: 'Danışıq' },
  { key: 'listening', icon: 'headphones', ru: 'Понимание на слух', az: 'Dinləmə' },
  { key: 'words', icon: 'book-open', ru: 'Слова', az: 'Sözlər' },
  { key: 'grammar', icon: 'pencil', ru: 'Грамматика', az: 'Qrammatika' },
];

export default function SetupGoalsScreen() {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const router = useRouter();
  /** `?from=parent` — настройка из родительского раздела: сохранить и назад. */
  const fromParent = useLocalSearchParams<{ from?: string }>().from === 'parent';
  const accent = useAccent();
  const childId = useSettings((s) => s.childId);
  const authToken = useSettings((s) => s.authToken);
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
    if (fromParent) {
      // Цели знает и сервер: по ним персонаж с первого разговора «помнит», зачем
      // ребёнок учит язык. Раньше «Сохранить» меняло их только на телефоне.
      // Упор (`learningFocus`) остаётся на телефоне: уроки под него перенастраивает
      // «Настроить уроки», а не этот экран.
      if (childId && authToken) {
        updateChild(childId, { goal: goals[0], goals }, authToken).catch(() => {});
      }
      router.back();
    } else router.push('/setup/schedule');
  };

  return (
    // Цели выбирает родитель — «взрослый» режим.
    <UIModeProvider force="teen">
    <Screen scroll>
      {fromParent ? (
        // Открыт как настройка: шапка с выходом без сохранения.
        <ScreenHeader
          safeTop={false}
          title={isAz ? 'Məqsəd və fokus' : 'Цели и упор'}
          subtitle={isAz ? `${childName} niyə öyrənir · 1–2 seç` : `Зачем ${childName} учит язык · 1–2`}
          style={styles.settingsHeader}
        />
      ) : (
        <>
          <StepIndicator current={6} total={7} />
          <Animated.View entering={FadeInDown.duration(600).delay(100)} style={styles.header}>
            <Text variant="title" align="center">
              {isAz ? `${childName} niyə öyrənir?` : `Зачем ${childName} учит язык?`}
            </Text>
            <Text variant="subtitle" tone="secondary" align="center" style={{ marginTop: spacing[3] }}>
              {isAz ? 'Dərsləri buna görə kökləyəcəyik · bir və ya iki' : 'Под это настроим уроки · одну или две'}
            </Text>
          </Animated.View>
        </>
      )}

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
                accessibilityRole="checkbox"
                accessibilityState={{ checked: sel, disabled: !sel && atCap }}
                style={[
                  styles.goalCard,
                  { borderColor: sel ? accent.bottom : c.border, backgroundColor: sel ? accent.soft : c.white },
                  !sel && atCap && { opacity: 0.5 },
                ]}
              >
                <Icon name={g.icon} size={22} color={sel ? accent.ink : c.inkSoft} />
                <Text style={[styles.goalText, sel && { color: accent.ink }]}>{isAz ? g.az : g.ru}</Text>
                {isPrimary && (
                  <Text style={[styles.primaryTag, { color: accent.ink }]}>{isAz ? 'əsas' : 'главное'}</Text>
                )}
                <View style={[styles.radio, sel && { backgroundColor: accent.bottom, borderColor: accent.bottom }]}>
                  {sel && <Icon name="check" size={14} color={accent.text} strokeWidth={3} />}
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
            <Pressable
              key={f.key}
              onPress={() => toggleFocus(f.key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: sel }}
              style={[styles.chip, sel && { backgroundColor: accent.bottom, borderColor: accent.bottom }]}
            >
              <Icon name={f.icon} size={16} color={sel ? accent.text : c.inkSoft} />
              <Text style={[styles.chipText, sel && { color: accent.text }]}>{isAz ? f.az : f.ru}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.cta}>
        <HBButton
          full
          variant={goals.length ? 'primary' : 'soft'}
          icon={fromParent ? 'check' : undefined}
          label={fromParent ? (isAz ? 'Yadda saxla' : 'Сохранить') : isAz ? 'Davam et' : 'Продолжить'}
          onPress={handleContinue}
          disabled={!goals.length}
        />
      </View>
    </Screen>
    </UIModeProvider>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  header: { marginTop: spacing[4], marginBottom: spacing[5], paddingHorizontal: spacing[2] },
  settingsHeader: { paddingHorizontal: 0, marginBottom: spacing[3] },
  cards: { gap: spacing[3], marginBottom: spacing[4] },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 2,
  },
  goalText: { flex: 1, fontFamily: fontFamily.bodyBlack, fontSize: scaleFont(15), color: t.c.ink },
  primaryTag: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize['3xs'],
    color: t.c.primaryDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    backgroundColor: t.c.white,
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
    borderColor: t.c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.caption,
    color: t.c.inkSoft,
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
    backgroundColor: t.c.white,
    borderWidth: 2,
    borderColor: t.c.border,
  },
  chipText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: t.c.ink },

  cta: { paddingBottom: spacing[6] },
}));
