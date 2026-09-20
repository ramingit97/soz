/**
 * Главный экран.
 *
 * Решение владельца 2026-09-14: простота и одна понятная вещь. Сверху — кто и как
 * дела (питомец, серия, звёзды), под ним одна карточка «Урок дня» с шагами урока.
 * Разговор на тему и история на слух — не отдельные плитки, а шаги плана дня;
 * серия, слова и «что помнит персонаж» — во вкладке «Прогресс», комната
 * питомца — по нажатию на него. Свободный разговор — вкладка «Говорить».
 *
 * Данные и эффекты — в `useHomeData`, выбор состояния — `deriveHomeState`
 * (с тестами), экран отвечает только за вид.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { BottomTabs, BottomTabsSpacer } from '@/components/BottomTabs';
import { HBCard } from '@/components/HBCard';
import { HBChip } from '@/components/HBChip';
import { HBIconBox } from '@/components/HBIconBox';
import { HBPet } from '@/components/HBPet';
import { Icon } from '@/components/Icon';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeScene } from '@/components/scene/HomeScene';
import { WeekStrip } from '@/components/home/WeekStrip';
import { HomeHero } from '@/components/home/HomeHero';
import { PaperBackground } from '@/components/PaperBackground';
import { ParentalGateModal, useParentalGate } from '@/components/ParentalGate';
import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import { useHomeData } from '@/hooks/useHomeData';
import { track } from '@/services/analytics';
import { useSettings } from '@/store/settings';
import { fontFamily, fontSize, radius, scaleFont, shadow, spacing } from '@/theme';
import { useCompanionName, withCompanionName } from '@/utils/companion';
import { deriveHomeState, resumeStep, todayPlanSteps, type HomeState } from '@/utils/homeState';
import { lessonStepRoute } from '@/utils/lessonFlow';
import { makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

declare const __DEV__: boolean;

// ─── Adult learner home — a talk-hub instead of the kid lesson flow ──────────

function adultGoalLabel(goal: string | null, isAz: boolean): string {
  const map: Record<string, [string, string]> = {
    travel: ['Путешествия', 'Səyahət'],
    career: ['Работа и карьера', 'İş və karyera'],
    interview: ['Собеседование', 'Müsahibə'],
    move: ['Переезд', 'Köçmək'],
    family: ['Общение с близкими', 'Yaxınlarla ünsiyyət'],
    fun: ['Фильмы и хобби', 'Filmlər və hobbi'],
  };
  const v = goal ? map[goal] : undefined;
  if (!v) return isAz ? 'Dil öyrənmək' : 'Учить язык';
  return isAz ? v[1] : v[0];
}

const ROLEPLAY_BY_GOAL: Record<string, string> = {
  travel: 'Roleplay a travel situation: at the airport, hotel check-in, or asking for directions.',
  career: 'Roleplay a friendly job interview.',
  interview: 'Roleplay a friendly job interview.',
  move: 'Roleplay renting an apartment and talking with a landlord.',
  family: 'Roleplay a warm everyday conversation with a friend.',
  fun: 'Roleplay chatting about movies, music and hobbies.',
};

function AdultHome() {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const goal = useSettings((s) => s.goal);
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const streak = useSettings((s) => s.streak);
  const totalStars = useSettings((s) => s.totalStars);
  const isPremium = useSettings((s) => s.isPremium);
  const userId = useSettings((s) => s.userId);
  const childId = useSettings((s) => s.childId);
  const isAz = lang === 'az';
  const learnLang = learningLanguages[0] ?? 'en';

  const go = (mode: string, scenario?: string, premium?: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Roleplay / Debate are premium for adults; free chat stays free.
    if (premium && !isPremium) {
      track({ event: 'paywall_viewed', userId, childId, props: { source: 'adult_mode', mode } });
      router.push('/paywall' as any);
      return;
    }
    track({ event: 'adult_talk_started', userId, childId, props: { mode } });
    const s = scenario ? `&scenario=${encodeURIComponent(scenario)}` : '';
    router.push(`/talk?lang=${learnLang}&day=1${s}` as any);
  };

  const roleplay = ROLEPLAY_BY_GOAL[goal ?? ''] ?? 'Roleplay an everyday small-talk situation.';
  const debate =
    'Friendly debate — pick a fun topic, take a side, and help me argue my points in the language I am learning.';

  const MODES = [
    { key: 'free', emoji: '💬', ru: 'Свободный разговор', az: 'Sərbəst söhbət', subRu: 'Болтай с Бобо о чём угодно', subAz: 'Hər mövzuda danış', tint: c.primary, scenario: undefined as string | undefined, premium: false },
    { key: 'roleplay', emoji: '🎭', ru: 'Ролевая игра', az: 'Rollu oyun', subRu: goal ? 'Сценка по твоей цели' : 'Разыграйте сценку', subAz: 'Səhnə oyna', tint: c.accent, scenario: roleplay, premium: true },
    { key: 'debate', emoji: '⚖️', ru: 'Дебаты', az: 'Debatlar', subRu: 'Отстаивай свою точку зрения', subAz: 'Fikrini müdafiə et', tint: c.berry, scenario: debate, premium: true },
  ];

  return (
    <PaperBackground>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.topBar}>
          <View style={[styles.petAvatar, shadow.sm]}>
            <HBPet size={32} hue={175} mood="happy" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.tbGreeting}>
              {isAz ? `Salam, ${childName}!` : `Привет, ${childName}!`}
            </Text>
            <Text style={styles.tbSubtitle}>
              {isAz ? 'Bu gün nə üzərində işləyək?' : 'Над чем поработаем сегодня?'}
            </Text>
          </View>
          {streak > 0 && (
            <HBChip label={String(streak)} leadingIcon={<Text style={{ fontSize: 14 }}>🔥</Text>} />
          )}
          <HBChip label={String(totalStars)} leadingIcon={<Text style={{ fontSize: 14 }}>⭐</Text>} />
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(80)}>
          <HBCard style={styles.goalCard} depth="sm">
            <Text style={styles.goalLabel}>{isAz ? '🎯 Hədəfin' : '🎯 Твоя цель'}</Text>
            <Text style={styles.adultGoalText}>{adultGoalLabel(goal, isAz)}</Text>
          </HBCard>
        </Animated.View>

        {MODES.map((m, i) => (
          <Animated.View key={m.key} entering={FadeInUp.duration(500).delay(150 + i * 80)}>
            <Pressable
              onPress={() => go(m.key, m.scenario, m.premium)}
              style={({ pressed }) => [pressed && { opacity: 0.9 }]}
            >
              <HBCard
                style={styles.modeCard}
                depth={i === 0 ? 'deep' : 'sm'}
                ringColor={i === 0 ? m.tint : undefined}
              >
                <View style={[styles.modeEmoji, { backgroundColor: c.bg }]}>
                  <Text style={{ fontSize: 26 }}>{m.emoji}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.modeTitle}>{isAz ? m.az : m.ru}</Text>
                  <Text style={styles.modeSub}>
                    {m.premium && !isPremium
                      ? isAz ? 'Premium' : 'Premium'
                      : isAz ? m.subAz : m.subRu}
                  </Text>
                </View>
                <Text style={styles.ctaArrow}>{m.premium && !isPremium ? '👑' : '›'}</Text>
              </HBCard>
            </Pressable>
          </Animated.View>
        ))}

        <BottomTabsSpacer />
      </ScrollView>
      <BottomTabs />
    </PaperBackground>
  );
}

/**
 * Высота сцены под содержимым. При 520 dp трава острова приходится примерно на
 * 324 dp от верха экрана — как раз под ноги Бобо, а карточка урока ложится на
 * нижний край острова, как лист в макете.
 */
const SCENE_HEIGHT = 520;

/** Что Бобо говорит с острова — по состоянию главного экрана. */
function sceneLine(state: HomeState, az: boolean, name: string, bot: string, theme: string | null): string {
  const hi = az ? `Salam, ${name}!` : `Салам, ${name}!`;
  switch (state) {
    case 'lesson':
      return theme ? `${hi} ${az ? 'Bu gün:' : 'Сегодня:'} ${theme}` : hi;
    case 'quiz':
      return `${hi} ${az ? 'Həftəni yoxlayaq' : 'Проверим неделю'}`;
    case 'done':
      return az ? 'Əla iş! Sabah görüşərik' : 'Отличная работа! Увидимся завтра';
    case 'preparing':
    case 'generating':
      return az ? 'Sənin dərsini yığıram…' : 'Собираю твой урок…';
    case 'error':
      return az ? 'İnternet itdi deyəsən' : 'Кажется, пропал интернет';
    default:
      return hi;
  }
}

export default function HomeScreen() {
  const { c, mode: uiMode, t } = useTheme();
  const homeStyles = homeStylesByMode[uiMode];
  const router = useRouter();
  const isAz = useSettings((s) => s.parentUILanguage) === 'az';
  const childName = useSettings((s) => s.childName) ?? '';
  const totalStars = useSettings((s) => s.totalStars);
  const streak = useSettings((s) => s.streak);
  const petHue = useSettings((s) => s.petHue);
  const userId = useSettings((s) => s.userId);
  const childId = useSettings((s) => s.childId);
  const profileType = useSettings((s) => s.profileType);
  const lessonStepsDone = useSettings((s) => s.lessonStepsDone);
  const lastCompletedDate = useSettings((s) => s.lastCompletedDate);
  const childLevel = useSettings((s) => s.childLevel);
  const reset = useSettings((s) => s.reset);
  const bot = useCompanionName();
  const data = useHomeData();
  const parentalGate = useParentalGate();

  // Adult learners get a talk-hub home instead of the kid lesson flow.
  if (profileType === 'adult') return <AdultHome />;

  const { firstLang, currentDay } = data;
  // Завершение урока сразу переводит currentDay на следующий день. Выполненный
  // сегодня урок — это вчерашний по счётчику: его тему и шаги и показываем.
  const shownDay = data.doneToday ? Math.max(1, currentDay - 1) : currentDay;
  const lesson = shownDay === currentDay ? data.lesson : getLesson(firstLang, shownDay);
  const state = deriveHomeState({
    isTrialMode: data.isTrialMode,
    currentDay,
    needsUpgrade: data.needsUpgrade,
    isAiDay: data.isAiDay,
    curriculumReady: data.curriculumReady,
    curriculumError: data.curriculumError,
    hasLesson: !!data.lesson,
    doneToday: data.doneToday,
    isQuizDay: data.isQuizDay,
  });
  const steps = todayPlanSteps({ focus: lesson?.focus, mature: data.mature, isQuizDay: data.isQuizDay });
  const doneSteps = (childId && lessonStepsDone[`${childId}:${firstLang}:${currentDay}`]) || [];
  const nextStep = resumeStep(steps, doneSteps);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Never start a bundled-template lesson while the child's AI plan for this
    // day is still generating.
    if (!data.ensureTodayLesson()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Alert.alert('', isAz ? `${bot} bu dərsi hələ yığır — bir dəqiqə!` : `${bot} ещё собирает этот урок — секундочку!`);
      return;
    }
    const focus = lesson?.focus;
    track({ event: 'lesson_started', userId, childId, props: { lang: firstLang, day: currentDay, mode: focus ?? (data.mature ? 'read' : 'kid-mode') } });
    // Продолжаем с первого непройденного шага, а не с начала урока.
    router.push(lessonStepRoute(nextStep ?? steps[0] ?? 'words', focus, currentDay, firstLang, data.mature) as never);
  };

  const handleStartQuiz = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    track({ event: 'lesson_started', userId, childId, props: { lang: firstLang, day: currentDay, mode: 'quiz' } });
    router.push(`/lesson/quiz?lang=${firstLang}&endDay=${currentDay - 1}` as never);
  };

  const thread = data.dueThread;

  return (
    // Верхний инсет обязателен: у шапки больше нет жёсткого paddingTop 48, и без
    // него приветствие уезжало бы под системную строку на телефоне.
    <PaperBackground edges={['top', 'bottom']}>
      {/* Сцена под содержимым: остров Бобо в закатном небе (макет C).
          Только у детей: у взрослых фон ровный тёмно-синий (макет D). */}
      {uiMode === 'kid' ? <HomeScene height={SCENE_HEIGHT} /> : null}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={homeStyles.scroll}>
        <Animated.View entering={FadeInDown.duration(450)}>
          <HomeHeader
            isAz={isAz}
            childName={childName}
            petHue={petHue}
            petMood={data.doneToday ? 'sleepy' : 'happy'}
            streak={streak}
            totalStars={totalStars}
            freezeUsed={data.freezeUsedThisSession}
            onPetPress={() => router.push('/pet-room' as never)}
          />
        </Animated.View>

        {uiMode === 'kid' ? (
        <Animated.View entering={FadeInDown.duration(450).delay(60)} style={homeStyles.stage}>
          <View style={homeStyles.bubble}>
            <Text variant="bodyBold" align="center">
              {sceneLine(state, isAz, childName, bot, lesson?.theme ?? null)}
            </Text>
          </View>
          <View style={homeStyles.bubbleTail} />
          <HBPet
            size={t.mascot.hero}
            hue={petHue}
            mood={data.doneToday ? 'sleepy' : 'happy'}
            onTap={() => router.push('/pet-room' as never)}
          />
        </Animated.View>
        ) : null}

        {uiMode === 'teen' ? (
          <Animated.View entering={FadeInDown.duration(450).delay(60)}>
            <WeekStrip
              streak={streak}
              lastCompletedDate={lastCompletedDate}
              courseLabel={[
                firstLang === 'ru' ? (isAz ? 'Rus dili' : 'Русский') : (isAz ? 'İngilis dili' : 'Английский'),
                childLevel,
              ].filter(Boolean).join(', ')}
              isAz={isAz}
            />
          </Animated.View>
        ) : null}

        {thread ? (
          <Animated.View entering={FadeInDown.duration(450).delay(40)}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                router.push(`/talk?threadId=${thread.id}&lang=${thread.language}` as never);
              }}
              accessibilityRole="button"
            >
              <HBCard depth="sm" style={homeStyles.askCard}>
                <HBIconBox icon="message-circle" tint="sage" size={44} />
                <View style={homeStyles.askText}>
                  <Text variant="bodyBold">{isAz ? `${bot} soruşmaq istəyir` : `${bot} хочет спросить`}</Text>
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {withCompanionName(thread.text, bot)}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={c.inkSoft} />
              </HBCard>
            </Pressable>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInUp.duration(500).delay(80)}>
          <HomeHero
            state={state}
            isAz={isAz}
            bot={bot}
            childName={childName}
            currentDay={shownDay}
            theme={lesson?.theme ?? null}
            vocabulary={lesson?.vocabulary ?? []}
            steps={steps}
            doneSteps={data.doneToday ? steps : doneSteps}
            petHue={petHue}
            generating={data.generating || data.aiLessonReady === null}
            onStart={handleStart}
            onStartQuiz={handleStartQuiz}
            onTalk={() => router.push(`/talk?lang=${firstLang}&day=${currentDay}` as never)}
            onRegister={() => router.push('/auth/register' as never)}
            onPaywall={() => parentalGate.run(() => router.push('/paywall' as never))}
            onRetry={data.retryCurriculum}
            onContinueOffline={data.continueOffline}
            onGeneratePlan={data.generatePlan}
          />
        </Animated.View>

        {__DEV__ && (
          <Pressable onPress={() => { reset(); router.replace('/welcome'); }} style={homeStyles.devReset}>
            <Text variant="caption" tone="secondary">⚙ reset onboarding</Text>
          </Pressable>
        )}
        <BottomTabsSpacer />
      </ScrollView>

      <BottomTabs />
      <ParentalGateModal {...parentalGate.modalProps} />
    </PaperBackground>
  );
}

const homeStylesByMode = makeModeStyles((t) => StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    gap: spacing[4],
  },
  stage: { alignItems: 'center', gap: 0 },
  bubble: {
    backgroundColor: t.c.surface,
    borderRadius: 22,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginHorizontal: spacing[2],
    ...shadow.sm,
  },
  // Хвостик пузыря — повёрнутый квадрат, как в макете.
  bubbleTail: {
    width: 18,
    height: 18,
    marginTop: -9,
    borderRadius: 4,
    transform: [{ rotate: '45deg' }],
    backgroundColor: t.c.surface,
  },
  askCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  askText: { flex: 1, minWidth: 0 },
  devReset: { alignItems: 'center', paddingVertical: spacing[2] },
}));

// Экран взрослого пока прежний — его упрощение отдельной задачей.
const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[12],
    paddingBottom: spacing[4],
    gap: spacing[3],
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  petAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: t.c.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tbGreeting: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: t.c.ink,
    letterSpacing: -0.2,
  },
  tbSubtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['2xs'],
    color: t.c.inkSoft,
    marginTop: 1,
  },
  goalCard: {
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  goalLabel: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.sm,
    color: t.c.ink,
  },
  adultGoalText: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: t.c.ink,
    marginTop: 2,
    letterSpacing: -0.3,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  modeEmoji: {
    width: 52,
    height: 52,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: t.c.ink,
  },
  modeSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: t.c.inkSoft,
    marginTop: 2,
  },
  ctaArrow: {
    fontSize: scaleFont(22),
    color: t.c.inkSoft,
    fontFamily: fontFamily.bodyBold,
  },
}));
