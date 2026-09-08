/**
 * "Собираю твой план" — the moment right after onboarding where the AI
 * curriculum (started server-side at createChild) becomes visible progress.
 * Week 1 is awaited with a real progress bar (cached lessons / 30); weeks 2-5
 * keep generating in the background after the child moves on.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { StarParticle } from '@/components/StarParticle';
import { Text } from '@/components/Text';
import { createChild } from '@/services/api';
import { fetchFullCurriculum } from '@/services/curriculum';
import { ensureGuestSession } from '@/services/guestSession';
import { scheduleLessonReminders } from '@/services/notifications';
import { playSfx } from '@/services/sfx';
import { focusToLessonPrefs, useSettings } from '@/store/settings';
import { useCompanionName } from '@/utils/companion';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

const TOTAL_DAYS = 30;
// Day 1 is generated fast server-side (single small LLM call); the rest of
// week 1 and weeks 2-5 keep filling in the background after the child moves on.
const READY_COUNT = 1;

type Phase = 'building' | 'ready' | 'error';

export default function SetupBuildingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ create?: string }>();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const isAz = lang === 'az';
  const childId = useSettings((s) => s.childId);
  const childName = useSettings((s) => s.childName) ?? '';
  const childInterests = useSettings((s) => s.childInterests);
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const authToken = useSettings((s) => s.authToken);
  const petHue = useSettings((s) => s.petHue);
  const bot = useCompanionName();

  // create=1: onboarding lands here directly (no summary page) — this screen
  // creates the child itself, then shows the AI-plan build progress.
  const wantsCreate = params.create === '1';
  const [created, setCreated] = useState(!wantsCreate);
  const creatingRef = useRef(false);
  const childAge = useSettings((s) => s.childAge) ?? 8;
  const childAgeBand = useSettings((s) => s.childAgeBand);
  const petName = useSettings((s) => s.petName);
  const childLevel = useSettings((s) => s.childLevel) ?? 'beginner';
  const learningFocus = useSettings((s) => s.learningFocus);
  const scheduleDays = useSettings((s) => s.scheduleDays);
  const scheduleMinutes = useSettings((s) => s.scheduleMinutes);
  const scheduleHour = useSettings((s) => s.scheduleHour);
  const completeOnboarding = useSettings((s) => s.completeOnboarding);
  const syncChild = useSettings((s) => s.syncChild);
  const setAuth = useSettings((s) => s.setAuth);
  const profileType = useSettings((s) => s.profileType);
  const goal = useSettings((s) => s.goal);
  const goalsAll = useSettings((s) => s.goalsAll);
  const proactiveOptIn = useSettings((s) => s.proactiveOptIn);

  const [phase, setPhase] = useState<Phase>('building');
  const [cached, setCached] = useState(0);
  const [stage, setStage] = useState(0); // 0..2 cosmetic → 3 = week 1 done
  const [retryTick, setRetryTick] = useState(0);
  const [stars, setStars] = useState<number[]>([]);

  const progress = useSharedValue(0.05);
  const creep = useSharedValue(0.05);
  const cancelled = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const firstLang = learningLanguages[0] ?? 'en';
  const interestLine = childInterests.slice(0, 2).join(', ');

  // The trial needs a token too: every AI endpoint requires one, and the child
  // profile is what /talk, /progress and memory all hang off. So before building
  // anything, an unauthenticated user is given an anonymous guest ACCOUNT — a
  // real row with a real token — which sign-up later upgrades in place. Without
  // this the trial would have no childId and no way to reach the AI at all.
  const bootstrappingRef = useRef(false);
  useEffect(() => {
    if (authToken || !wantsCreate || bootstrappingRef.current) return;
    bootstrappingRef.current = true;
    (async () => {
      const session = await ensureGuestSession();
      if (session) {
        setAuth(session.token, session.userId, '', true);
      } else {
        setPhase('error'); // offline on first launch — retry is already wired up
      }
      bootstrappingRef.current = false;
    })();
  }, [authToken, wantsCreate, retryTick]);

  // No fresh child to build for (deep link with nothing to create) → skip.
  useEffect(() => {
    if (!wantsCreate && !childId) router.replace('/home');
  }, [childId, wantsCreate]);

  // create=1: create the child on the server first (was the summary page's job).
  // The server kicks off day-1 generation inside createChild, so the progress
  // polling below picks it up as soon as this resolves.
  useEffect(() => {
    if (!wantsCreate || created || !authToken || creatingRef.current) return;
    creatingRef.current = true;
    (async () => {
      try {
        const child = await createChild(
          {
            name: childName || (isAz ? 'Uşaq' : 'Ребёнок'),
            age: childAge,
            ageBand: childAgeBand ?? undefined,
            petName: petName ?? undefined,
            level: childLevel,
            learningLanguages: learningLanguages.length > 0 ? learningLanguages : ['en'],
            interests: childInterests.length > 0 ? childInterests : undefined,
            lessonPrefs: learningFocus.length > 0 ? focusToLessonPrefs(learningFocus) : undefined,
            scheduleDays,
            scheduleMinutes,
            scheduleHour,
            profileType,
            goal: goal ?? undefined,
            goals: goalsAll.length ? goalsAll : goal ? [goal] : undefined,
            proactiveOptIn: proactiveOptIn ? 1 : 0,
          },
          authToken,
        );
        syncChild(child);
        completeOnboarding();
        scheduleLessonReminders(child.name, scheduleHour, scheduleDays, isAz).catch(() => {});
        setCreated(true);
      } catch {
        setPhase('error');
      } finally {
        creatingRef.current = false;
      }
    })();
  }, [wantsCreate, created, authToken, retryTick]);

  // Cosmetic first stages — the profile/themes really WERE consumed by the
  // generator at createChild; these lines narrate it while week 1 finishes.
  useEffect(() => {
    if (phase !== 'building') return;
    setStage(0);
    timers.current.push(setTimeout(() => setStage(1), 1300));
    timers.current.push(setTimeout(() => setStage(2), 2600));
    // Indeterminate creep while the first fetch awaits day-1 generation (~8-15s)
    creep.value = 0.05;
    creep.value = withTiming(0.18, { duration: 12_000 });
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [phase, retryTick]);

  // Real progress: poll the curriculum cache count (server generates week 1 on
  // the first await, weeks 2-5 in background).
  useEffect(() => {
    if (!childId || !authToken || !created || phase === 'ready') return;
    cancelled.current = false;
    let attempts = 0;

    const poll = async () => {
      const n = await fetchFullCurriculum(childId, firstLang, authToken);
      if (cancelled.current) return;
      setCached(n);
      if (n >= READY_COUNT) {
        setStage(3);
        setPhase('ready');
        progress.value = withSpring(Math.max(0.15, n / TOTAL_DAYS), { damping: 14 });
        playSfx('fanfare', 0.7);
        const ids = [1, 2, 3, 4, 5];
        setStars(ids);
        setTimeout(() => setStars([]), 1400);
        // Second learning language: warm its plan in the background.
        for (const l of learningLanguages.slice(1)) {
          fetchFullCurriculum(childId, l, authToken).catch(() => {});
        }
        return;
      }
      if (n === 0) {
        attempts += 1;
        if (attempts >= 3) {
          setPhase('error');
          return;
        }
        timers.current.push(setTimeout(poll, 5000));
        return;
      }
      // Partial (<7) — server still writing week 1; show what we have.
      progress.value = withSpring(Math.max(0.08, n / TOTAL_DAYS), { damping: 14 });
      timers.current.push(setTimeout(poll, 4000));
    };

    poll();
    return () => {
      cancelled.current = true;
    };
  }, [childId, authToken, firstLang, created, retryTick]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.min(100, Math.max(progress.value, phase === 'building' ? creep.value : 0) * 100)}%`,
  }));

  const stages = [
    isAz ? `${childName} profilini öyrəndim` : `Изучил профиль ${childName}`,
    interestLine
      ? (isAz ? `Mövzular seçdim: ${interestLine}` : `Подобрал темы: ${interestLine}`)
      : (isAz ? 'Mövzuları seçdim' : 'Подобрал темы'),
    isAz ? 'İlk dərsi yığıram…' : 'Собираю первый урок…',
  ];

  const retry = () => {
    setPhase('building');
    setCached(0);
    progress.value = 0.05;
    setRetryTick((t) => t + 1);
  };

  return (
    <PaperBackground>
      <View style={styles.root}>
        <Animated.View entering={FadeInDown.duration(600)} style={styles.hero}>
          <View style={styles.halo}>
            <HBPet size={120} hue={petHue} mood={phase === 'error' ? 'sad' : 'happy'} talking={phase === 'building'} />
            {stars.map((id) => (
              <StarParticle key={id} x={20 + id * 18} y={id % 2 === 0 ? 0 : 16} delay={id * 90} />
            ))}
          </View>
          <Text style={styles.title}>
            {phase === 'ready'
              ? (isAz ? 'İlk dərs hazırdır! 🎉' : 'Первый урок готов! 🎉')
              : phase === 'error'
                ? (isAz ? 'Alınmadı 😕' : 'Не получилось 😕')
                : (isAz ? 'Planını yığıram ✨' : 'Собираю твой план ✨')}
          </Text>
          <Text style={styles.sub}>
            {phase === 'ready'
              ? (isAz
                  ? `Qalan həftə və bütün plan arxa planda yığılır.`
                  : `Остальная неделя и весь план собираются в фоне.`)
              : phase === 'error'
                ? (isAz ? 'İnterneti yoxla və yenidən cəhd et.' : 'Проверь интернет и попробуй ещё раз.')
                : (isAz
                    ? `${bot} sənin üçün fərdi 30 günlük plan yaradır.`
                    : `${bot} создаёт для тебя персональный план на 30 дней.`)}
          </Text>
        </Animated.View>

        {phase !== 'error' && (
          <Animated.View entering={FadeInUp.duration(500).delay(150)}>
            <HBCard style={styles.card} depth="md">
              {stages.map((label, i) => {
                const done = stage > i || (i === 2 && phase === 'ready');
                const active = stage === i && phase === 'building';
                if (stage < i) return null;
                return (
                  <Animated.View key={i} entering={FadeIn.duration(350)} style={styles.stageRow}>
                    <Text style={[styles.stageMark, done && { color: colors.accent }]}>
                      {done ? '✓' : '▸'}
                    </Text>
                    <Text style={[styles.stageText, active && { color: colors.ink }]}>{label}</Text>
                  </Animated.View>
                );
              })}

              {/* progress bar */}
              <View style={styles.barTrack}>
                <Animated.View style={[styles.barFill, barStyle]} />
              </View>
              <Text style={styles.barCaption}>
                {cached > 0
                  ? (isAz ? `${cached} / ${TOTAL_DAYS} dərs hazırdır` : `${cached} из ${TOTAL_DAYS} уроков готово`)
                  : (isAz ? 'AI dərsləri yaradır…' : 'AI создаёт уроки…')}
              </Text>

              {phase === 'building' && (
                <Text style={styles.bgNote}>
                  {isAz ? '2–5-ci həftələr arxa planda yığılacaq' : 'Недели 2–5 соберутся в фоне'}
                </Text>
              )}
            </HBCard>
          </Animated.View>
        )}

        <View style={styles.footer}>
          {phase === 'ready' && (
            <Animated.View entering={FadeInUp.duration(450)}>
              <HBButton
                full
                variant="primary"
                label={isAz ? 'Gedək! 🚀' : 'Поехали! 🚀'}
                onPress={() => router.replace('/home')}
              />
            </Animated.View>
          )}
          {phase === 'error' && (
            <Animated.View entering={FadeInUp.duration(450)} style={{ gap: spacing[2] }}>
              <HBButton full variant="primary" label={isAz ? 'Yenidən cəhd et' : 'Повторить'} onPress={retry} />
              <HBButton
                full
                variant="ghost"
                label={isAz ? 'Davam et' : 'Продолжить'}
                onPress={() => router.replace('/home')}
              />
            </Animated.View>
          )}
        </View>
      </View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: 90,
    paddingBottom: spacing[8],
  },
  hero: { alignItems: 'center', gap: spacing[2] },
  halo: {
    width: 168,
    height: 168,
    borderRadius: radius.full,
    backgroundColor: 'rgba(245, 212, 102, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'],
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  sub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing[2],
  },
  card: {
    marginTop: spacing[6],
    padding: spacing[5],
    gap: spacing[3],
  },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  stageMark: {
    width: 20,
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.base,
    color: colors.primary,
  },
  stageText: {
    flex: 1,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
  barTrack: {
    height: 14,
    borderRadius: radius.full,
    backgroundColor: colors.bgDeep,
    overflow: 'hidden',
    marginTop: spacing[2],
  },
  barFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  barCaption: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  bgNote: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footer: { flex: 1, justifyContent: 'flex-end' },
});
