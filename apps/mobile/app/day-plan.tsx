/**
 * Day plan — visual breakdown of today's 3 activities.
 * Accessed from home screen. Shows current / done / upcoming states.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { BottomTabsSpacer } from '@/components/BottomTabs';
import { HBBackButton } from '@/components/HBBackButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { fetchCurriculumLesson, getCachedCurriculumLesson } from '@/services/curriculum';
import { useSettings, todayISO } from '@/store/settings';
import { isMatureLearner, lessonEntryRoute } from '@/utils/lessonFlow';
import { getLesson, STATIC_MAX_DAY, type LessonFocus } from '@/data/lessons';
import { worldForDay, worldLabel } from '@/data/worlds';
import { colors, fontFamily, fontSize, radius, shadow, spacing, tints } from '@/theme';

type TaskState = 'done' | 'current' | 'next' | 'locked';

interface DayTask {
  id: string;
  emoji: string;
  titleRu: string;
  titleAz: string;
  descRu: string;
  descAz: string;
  durationRu: string;
  durationAz: string;
  color: string;
  tint: string;
  route: (day: number, lang: string) => string;
  minDay?: number;
}

const TASKS: DayTask[] = [
  {
    id: 'read',
    emoji: '📚',
    titleRu: 'История дня',
    titleAz: 'Günün hekayəsi',
    descRu: 'Прочитай мини-историю с Хани',
    descAz: 'Hani ilə mini hekayəni oxu',
    durationRu: '2–3 мин',
    durationAz: '2–3 dəq',
    color: '#8E7BFF',
    tint: '#EAE6FF',
    route: (day, lang) => `/read?lang=${lang}&day=${day}`,
  },
  {
    id: 'lesson',
    emoji: '📖',
    titleRu: 'Урок дня',
    titleAz: 'Günün dərsi',
    descRu: 'Новые слова и упражнения',
    descAz: 'Yeni sözlər və tapşırıqlar',
    durationRu: '10–15 мин',
    durationAz: '10–15 dəq',
    color: colors.primary,
    tint: colors.primarySoft,
    // Route is level-aware — resolved in onPress via lessonEntryRoute (kids:
    // playful rotation; teens/B1+: text-first read → grammar → talk).
    route: (day, lang) => lessonEntryRoute(day, lang, false),
  },
  {
    id: 'talk',
    emoji: '🗣️',
    titleRu: 'Поговори с Хани',
    titleAz: 'Hani ilə danış',
    descRu: 'Свободный разговор на выученные темы',
    descAz: 'Öyrənilmiş mövzularda söhbət',
    durationRu: '5–10 мин',
    durationAz: '5–10 dəq',
    color: colors.accent,
    tint: tints.sage,
    route: (day, lang) => `/talk?lang=${lang}&day=${day}`,
  },
  {
    id: 'listen',
    emoji: '🎧',
    titleRu: 'Послушай историю',
    titleAz: 'Hekayəni dinlə',
    descRu: 'Хани расскажет историю — слушай и пойми',
    descAz: 'Hani hekayə danışır — dinlə və anla',
    durationRu: '5–7 мин',
    durationAz: '5–7 dəq',
    color: '#34C4A0',
    tint: tints.sage,
    route: () => '/listening',
  },
  {
    id: 'quiz',
    emoji: '⚡',
    titleRu: 'Недельный тест',
    titleAz: 'Həftəlik test',
    descRu: 'Повтори слова и проверь себя',
    descAz: 'Sözləri təkrarla və yoxla',
    durationRu: '5 мин',
    durationAz: '5 dəq',
    color: colors.butter,
    tint: '#FFF8D6',
    route: (day, lang) => `/lesson/quiz?lang=${lang}&endDay=${day - 1}`,
    minDay: 8,
  },
  {
    id: 'story',
    emoji: '🌟',
    titleRu: 'Приключение',
    titleAz: 'Macəra',
    descRu: 'Интерактивная история — выбирай путь!',
    descAz: 'İnteraktiv hekayə — yolu seç!',
    durationRu: '3–5 мин',
    durationAz: '3–5 dəq',
    color: '#E55C73',
    tint: tints.berry,
    route: (day, lang) => `/story?lang=${lang}&day=${day}`,
  },
  {
    id: 'photo',
    emoji: '📸',
    titleRu: 'Фото-урок',
    titleAz: 'Şəkil dərsi',
    descRu: 'Покажи Хани свою комнату — он назовёт слова',
    descAz: 'Hani-yə otağını göstər — sözləri deyəcək',
    durationRu: '2–3 мин',
    durationAz: '2–3 dəq',
    color: '#34C4A0',
    tint: '#D0F5EC',
    route: () => '/photo-learn',
  },
  {
    id: 'song',
    emoji: '🎶',
    titleRu: 'Песня дня',
    titleAz: 'Günün mahnısı',
    descRu: 'Спой со словами урока',
    descAz: 'Dərsin sözləri ilə oxu',
    durationRu: '2 мин',
    durationAz: '2 dəq',
    color: '#6B54E0',
    tint: '#EAE6FF',
    route: () => '/songs',
  },
];

// Which activity leads today, decided by the AI day's focus.
const HERO_FOR_FOCUS: Record<LessonFocus, string> = {
  story_listen: 'listen',
  conversation: 'talk',
  vocab_grammar: 'read',
  review: 'read',
};

function taskState(id: string, doneToday: boolean, currentDay: number, heroId: string): TaskState {
  if (doneToday) return 'done';
  if (id === 'quiz' && (currentDay < 8 || (currentDay - 1) % 7 !== 0)) return 'locked';
  if (id === heroId) return 'current';
  return 'next';
}

function stateLabel(state: TaskState, isAz: boolean): string {
  if (state === 'done') return isAz ? 'Tamamlandı' : 'Готово';
  if (state === 'current') return isAz ? 'İndi' : 'Сейчас';
  if (state === 'locked') return isAz ? 'Həftəlik' : 'По пятницам';
  return isAz ? 'Sonra' : 'Следующее';
}

function TaskCard({
  task,
  state,
  isAz,
  onPress,
}: {
  task: DayTask;
  state: TaskState;
  isAz: boolean;
  onPress: () => void;
}) {
  const isCurrent = state === 'current';
  const isDone = state === 'done';
  const isLocked = state === 'locked';

  return (
    <Pressable
      onPress={isLocked ? undefined : onPress}
      style={({ pressed }) => [
        pressed && !isLocked ? { transform: [{ scale: 0.98 }] } : undefined,
      ]}
    >
      <HBCard
        depth={isCurrent ? 'md' : 'sm'}
        ringColor={isCurrent ? task.color : undefined}
        style={[
          styles.taskCard,
          ...(isDone ? [styles.taskCardDone] : []),
          ...(isLocked ? [styles.taskCardLocked] : []),
        ]}
      >
        {/* Left icon */}
        <View style={[
          styles.iconBox,
          { backgroundColor: isDone ? tints.sage : isLocked ? colors.bgDeep : task.tint },
        ]}>
          <Text style={[styles.iconEmoji, isLocked && { opacity: 0.4 }]}>
            {isDone ? '✓' : task.emoji}
          </Text>
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <View style={styles.taskTitleRow}>
            <Text style={[styles.taskTitle, isDone && { color: colors.inkSoft }, isLocked && { color: colors.inkSoft, opacity: 0.5 }]}>
              {isAz ? task.titleAz : task.titleRu}
            </Text>
            <View style={[styles.stateBadge, { backgroundColor: isDone ? tints.sage : isCurrent ? task.tint : colors.bgDeep }]}>
              <Text style={[styles.stateBadgeText, { color: isDone ? colors.accent : isCurrent ? task.color : colors.inkSoft }]}>
                {stateLabel(state, isAz)}
              </Text>
            </View>
          </View>
          <Text style={[styles.taskDesc, isLocked && { opacity: 0.5 }]}>
            {isAz ? task.descAz : task.descRu}
          </Text>
          <View style={styles.taskMeta}>
            <Text style={styles.durationText}>
              ⏱ {isAz ? task.durationAz : task.durationRu}
            </Text>
          </View>
        </View>

        {/* Arrow */}
        {!isDone && !isLocked && (
          <Text style={[styles.arrow, { color: isCurrent ? task.color : colors.inkSoft }]}>›</Text>
        )}
        {isDone && <Text style={[styles.arrow, { color: colors.accent }]}>✓</Text>}
        {isLocked && <Text style={[styles.arrow, { color: colors.inkSoft, opacity: 0.3 }]}>🔒</Text>}
      </HBCard>
    </Pressable>
  );
}

export default function DayPlanScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const storedHue = useSettings((s) => s.petHue);
  const currentDay = useSettings((s) => s.currentDay);
  const streak = useSettings((s) => s.streak);
  const lastCompletedDate = useSettings((s) => s.lastCompletedDate);
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const childId = useSettings((s) => s.childId);
  const authToken = useSettings((s) => s.authToken);
  const childLevel = useSettings((s) => s.childLevel);
  const childAgeBand = useSettings((s) => s.childAgeBand);
  const isAz = lang === 'az';
  const firstLang = learningLanguages[0] ?? 'en';
  const mature = isMatureLearner(childLevel, childAgeBand);

  // Today's AI-chosen focus decides which activity leads the path.
  const focus = getLesson(firstLang, currentDay)?.focus;
  const heroId = HERO_FOR_FOCUS[focus ?? 'vocab_grammar'] ?? 'read';
  // Put the hero activity first; keep the rest in catalog order.
  const orderedTasks = [
    ...TASKS.filter((t) => t.id === heroId),
    ...TASKS.filter((t) => t.id !== heroId),
  ];
  const focusBanner: { ru: string; az: string } | null =
    focus === 'story_listen'
      ? { ru: '🎧 Сегодня — день слушания', az: '🎧 Bu gün — dinləmə günü' }
      : focus === 'conversation'
        ? { ru: '🗣️ Сегодня — день разговора', az: '🗣️ Bu gün — danışıq günü' }
        : focus === 'review'
          ? { ru: '🔁 Сегодня — повторение', az: '🔁 Bu gün — təkrar' }
          : null;

  const doneToday = lastCompletedDate === todayISO();
  const today = new Date();
  const dateStr = today.toLocaleDateString(isAz ? 'az-AZ' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  });

  const allDone = doneToday;
  const moodNow = allDone ? 'happy' : 'curious';

  return (
    <PaperBackground>
      {/* Top bar */}
      <View style={styles.topBar}>
        <HBBackButton inline />
        <Text style={styles.topTitle}>
          {isAz ? 'Bu günün planı' : 'План на сегодня'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <View style={styles.petHalo}>
            <HBPet size={80} hue={storedHue} mood={moodNow} />
          </View>

          <Text style={styles.greeting}>
            {allDone
              ? (isAz ? '🎉 Günü tamamladın!' : '🎉 День завершён!')
              : (isAz ? `${childName}, bu gün üçün 4 tapşırıq!` : `${childName}, 4 задания на сегодня!`)}
          </Text>
          <Text style={styles.dateText}>{dateStr}</Text>

          {/* Focus-of-the-day banner (AI-distributed across the week) */}
          {focusBanner && !allDone && (
            <View style={styles.focusBanner}>
              <Text style={styles.focusBannerText}>{isAz ? focusBanner.az : focusBanner.ru}</Text>
            </View>
          )}

          {/* World badge for today */}
          {(() => {
            const w = worldForDay(currentDay);
            return (
              <View style={[styles.worldBadgeRow, { backgroundColor: w.tint }]}>
                <Text style={{ fontSize: 18 }}>{w.emoji}</Text>
                <Text style={[styles.worldBadgeText, { color: w.color }]}>
                  {isAz ? 'Dünya: ' : 'Мир: '}{worldLabel(w, isAz ? 'az' : 'ru')}
                </Text>
              </View>
            );
          })()}

          {/* Mini stats */}
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statChipText}>📅 {isAz ? `Gün ${currentDay}` : `День ${currentDay}`}</Text>
            </View>
            {streak > 0 && (
              <View style={styles.statChip}>
                <Text style={styles.statChipText}>🔥 {streak} {isAz ? 'gün' : 'дней'}</Text>
              </View>
            )}
            <View style={styles.statChip}>
              <Text style={styles.statChipText}>
                {allDone ? (isAz ? '✓ Hazır' : '✓ Готово') : (isAz ? '0/4 tamamlandı' : '0/4 готово')}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Task cards */}
        <View style={styles.tasks}>
          {orderedTasks.map((task, i) => {
            const state = taskState(task.id, allDone, currentDay, heroId);
            return (
              <Animated.View key={task.id} entering={FadeInUp.duration(450).delay(120 + i * 90)}>
                <TaskCard
                  task={task}
                  state={state}
                  isAz={isAz}
                  onPress={() => {
                    // Lesson-content tasks must wait for the child's AI plan —
                    // never open the bundled template during generation.
                    const needsLessonContent = task.id === 'read' || task.id === 'lesson' || task.id === 'story';
                    if (
                      needsLessonContent && childId && authToken && currentDay <= STATIC_MAX_DAY &&
                      !getCachedCurriculumLesson(childId, firstLang, currentDay)
                    ) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                      fetchCurriculumLesson(childId, currentDay, firstLang, authToken).catch(() => {});
                      Alert.alert(
                        '⏳',
                        isAz
                          ? 'Dərsin hələ hazırlanır — bir dəqiqə!'
                          : 'Твой урок ещё готовится — секундочку!',
                      );
                      return;
                    }
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    let dest = task.id === 'lesson'
                      ? lessonEntryRoute(currentDay, firstLang, mature)
                      : task.route(currentDay, firstLang);
                    // Only the conversation HERO is a graded lesson — give it a real
                    // finish. The standalone "talk" practice tile stays open-ended.
                    if (task.id === 'talk' && task.id === heroId && focus === 'conversation') {
                      dest += '&fromLesson=1&convo=1';
                    }
                    router.push(dest as any);
                  }}
                />
              </Animated.View>
            );
          })}
        </View>

        {/* Encouragement card */}
        <Animated.View entering={FadeInUp.duration(400).delay(450)} style={styles.encourageCard}>
          <Text style={styles.encourageEmoji}>
            {allDone ? '🏆' : '💡'}
          </Text>
          <Text style={styles.encourageText}>
            {allDone
              ? (isAz ? 'Hani çox fərəhlənir! Sabah daha çox söz öyrənəcəksən.' : 'Хани очень доволен! Завтра узнаешь ещё больше слов.')
              : (isAz ? 'Hər tapşırıq bir az daha yaxşılaşdırır. Başla!' : 'Каждое задание делает тебя чуточку лучше. Начинай!')}
          </Text>
        </Animated.View>

        <BottomTabsSpacer />
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: 52,
    paddingBottom: spacing[3],
  },
  topTitle: { fontFamily: fontFamily.display, fontSize: fontSize.base, color: colors.ink },

  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
    gap: spacing[4],
  },

  header: { alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  petHalo: {
    width: 112,
    height: 112,
    borderRadius: 56,
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
  greeting: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  dateText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  focusBanner: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    alignSelf: 'center',
    marginTop: spacing[1],
  },
  focusBannerText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.sm,
    color: colors.primaryDeep,
    letterSpacing: 0.2,
  },
  worldBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    alignSelf: 'center',
    marginTop: spacing[1],
  },
  worldBadgeText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing[1],
  },
  statChip: {
    backgroundColor: colors.bgDeep,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  statChipText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },

  tasks: { gap: spacing[3] },

  taskCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  taskCardDone: { opacity: 0.8 },
  taskCardLocked: { opacity: 0.65 },

  iconBox: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 26 },

  taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: 3 },
  taskTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: colors.ink,
    flex: 1,
  },
  stateBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  stateBadgeText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 10,
    letterSpacing: 0.3,
  },

  taskDesc: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    lineHeight: 17,
  },
  taskMeta: { marginTop: spacing[2] },
  durationText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
  },
  arrow: {
    fontSize: 24,
    fontFamily: fontFamily.bodyBlack,
    marginLeft: spacing[1],
  },

  encourageCard: {
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
  encourageEmoji: { fontSize: 30 },
  encourageText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    flex: 1,
    lineHeight: 20,
  },
});
