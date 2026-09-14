/**
 * Honeybear · Talk to Бобо.
 *
 * Top bar: back + Бобо avatar + "Бобо · слушаю..." status + turn counter
 * Chat bubbles: Бобо bubble cream with RU subtitle, child bubble peach
 * Bottom: mic button on cream paper.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { playableAudioUri, readAsBase64 } from '@/utils/recording';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollView as ScrollViewType,
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

import { BottomTabs } from '@/components/BottomTabs';
import { HBChip } from '@/components/HBChip';
import { HBPet } from '@/components/HBPet';
import { MicButton } from '@/components/MicButton';
import { MicWaveform } from '@/components/MicWaveform';
import { ObjectiveChips } from '@/components/ObjectiveChips';
import { PaperBackground } from '@/components/PaperBackground';
import { ReactingPet, type ReactingPetHandle } from '@/components/ReactingPet';
import { StarParticle } from '@/components/StarParticle';
import { Text } from '@/components/Text';
import { track } from '@/services/analytics';
import { fetchTalkOpener, getTalkHint, isRateLimitError, markThreadAsked, postSessionEnd, postTalk, reportAiMessage, type TalkResponsePayload } from '@/services/api';
import { notifyParentSensitive } from '@/services/notifications';
import { playSfx } from '@/services/sfx';
import { loadTalkHistory, saveTalkHistory, type StoredTurn } from '@/services/talkHistory';
import { useSettings, todayISO } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';
import { canFinishTalkLesson, MIN_LESSON_TALK_TURNS, spokenTurns } from '@/utils/lessonTalk';
import { HBButton } from '@/components/HBButton';
import { Icon } from '@/components/Icon';
import type { LanguageCode } from '@soz/shared-types';

declare const __DEV__: boolean;

type Mood = 'idle' | 'recording' | 'thinking' | 'playing';

interface Turn {
  role: 'child' | 'bobo';
  text: string;
  ts: number;
  /** Words that Whisper had low confidence about — child turns only */
  unclearWords?: string[];
  /** STT confidence 0..1 — child turns only */
  confidence?: number;
}

// ─── Transcript with per-word pronunciation highlight ───────────────────────
function ChildTranscript({ text, unclearWords }: { text: string; unclearWords: string[] }) {
  if (!text || unclearWords.length === 0) {
    return <Text style={styles.bubbleText}>{text}</Text>;
  }
  // Lowercased set of unclear words for fast lookup
  const unclearSet = new Set(unclearWords.map((w) => w.toLowerCase().replace(/[.,!?]/g, '')));
  // Split text into word tokens, preserving spaces and punctuation
  const tokens = text.split(/(\s+)/);
  return (
    <Text style={styles.bubbleText}>
      {tokens.map((tok, i) => {
        const clean = tok.toLowerCase().replace(/[.,!?]/g, '');
        const isUnclear = clean.length > 0 && unclearSet.has(clean);
        return isUnclear ? (
          <Text key={i} style={styles.unclearWord}>{tok}</Text>
        ) : (
          <Text key={i}>{tok}</Text>
        );
      })}
    </Text>
  );
}

interface Particle {
  id: number;
  x: number;
  y: number;
  delay: number;
}

/**
 * Planned conversation-lesson length in seconds. Grows with age and level, plus
 * a boost when the learner's goal is real speaking (move abroad / free
 * communication / travel) — a B2 "going abroad" learner gets ~10-11 minutes,
 * a young beginner ~3.
 */
function targetTalkSeconds(
  level: string | null,
  ageBand: string | null,
  goals: string[],
): number {
  const baseMin =
    ageBand === 'young' ? 3 : ageBand === 'teen' ? 6 : ageBand === 'adult' ? 7 : 4;
  const levelBoost = level === 'intermediate' ? 2 : level === 'pre_intermediate' ? 1 : 0;
  const speakingGoal = goals.some((g) => g === 'move' || g === 'communication' || g === 'travel');
  return Math.min(12, baseMin + levelBoost + (speakingGoal ? 2 : 0)) * 60;
}

function formatMinSec(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function TalkScreen() {
  const params = useLocalSearchParams<{ lang?: string; day?: string; fromLesson?: string; threadId?: string; scenario?: string; goals?: string; convo?: string }>();
  const router = useRouter();
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const childId = useSettings((s) => s.childId);
  const userId = useSettings((s) => s.userId);
  const childName = useSettings((s) => s.childName);
  const childLevel = useSettings((s) => s.childLevel);
  const childAgeBand = useSettings((s) => s.childAgeBand);
  const petName = useSettings((s) => s.petName);
  const parentUILanguage = useSettings((s) => s.parentUILanguage);
  const bot = useCompanionName();
  const currentDay = useSettings((s) => s.currentDay);
  const fromLesson = params.fromLesson === '1';
  // A graded "conversation day" from the path (not free-chat / topics / threads):
  // it needs a real END. The session has a planned LENGTH (grows with age/level,
  // longer when the goal is real speaking); we send elapsed/target to the server
  // each turn and Бобо itself wraps up warmly when time is up ([[wrap]] marker →
  // wrapSuggested → finish banner → completion screen: stars, streak, day+1).
  // Soft — the child may keep chatting past it if they want.
  const convoLesson = params.convo === '1';
  const goalsAll = useSettings((s) => s.goalsAll);
  const convoTargetSec = useMemo(
    () => targetTalkSeconds(childLevel, childAgeBand, goalsAll),
    // Profile facts don't change mid-session — compute once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // Guard against a null/NaN day (e.g. currentDay not yet hydrated): the API's
  // day field is a number and would 400 on null. Always resolve to a finite day.
  const lessonDay = Number(params.day) || currentDay || 1;
  const apiLevel = childLevel ?? 'beginner';

  const [language, setLanguage] = useState<LanguageCode>(() => {
    if (params.lang === 'en' || params.lang === 'ru') return params.lang;
    return learningLanguages[0] ?? 'en';
  });

  const canSwitchLang = learningLanguages.length > 1;

  const [mood, setMood] = useState<Mood>('idle');
  const [history, setHistory] = useState<Turn[]>([]);
  // The previous conversation (loaded from storage) — shown muted above the live
  // chat so the child sees Бобо actually remembers. Not part of the live history.
  const [pastTurns, setPastTurns] = useState<StoredTurn[]>([]);
  const historyLoadedRef = useRef(false);
  const [latest, setLatest] = useState<TalkResponsePayload | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  // Topic checklist (from /topics): 3 micro-goals shown as chips, detected server-side
  const goals = useMemo<{ ru: string; az: string; en: string }[] | null>(() => {
    if (!params.goals) return null;
    try {
      const parsed = JSON.parse(params.goals);
      if (!Array.isArray(parsed) || parsed.length === 0) return null;
      return parsed.filter((g) => g && typeof g.en === 'string');
    } catch {
      return null;
    }
  }, [params.goals]);
  const [objDone, setObjDone] = useState<boolean[]>([]);
  const [goalsBanner, setGoalsBanner] = useState(false);
  const allDoneRef = useRef(false);

  // Lesson completion. `finishBanner` — the celebratory "finish?" banner is on
  // screen; `wrapUnlocked` — a timed conversation lesson reached its end (Бобо
  // wrapped up or the safety-net time passed). Completion itself is gated by
  // canFinishTalkLesson: no real speaking — no credit.
  const [finishBanner, setFinishBanner] = useState(false);
  const [wrapUnlocked, setWrapUnlocked] = useState(false);
  const [convoElapsed, setConvoElapsed] = useState(0); // seconds, drives the progress bar
  const convoStartRef = useRef(Date.now());
  const convoDoneRef = useRef(false);
  // The real crisis alert is raised SERVER-side (email + persisted record), so it
  // survives the app being closed. This local notification is only the immediate
  // nudge for a parent who happens to be holding the device — once per session is
  // plenty; it used to re-fire on every flagged turn.
  const crisisNotifiedRef = useRef(false);
  const spoken = spokenTurns(history);
  const canFinish = fromLesson && canFinishTalkLesson({ spoken, convoLesson, wrapUnlocked });
  const finishLesson = useCallback(() => {
    if (!canFinish) return;
    router.replace(`/lesson/complete?lang=${language}&day=${lessonDay}`);
  }, [router, language, lessonDay, canFinish]);

  // The moment the lesson becomes finishable, offer it once. A timed lesson
  // already celebrated at the wrap; the plain lesson step celebrates here.
  const finishOfferedRef = useRef(false);
  useEffect(() => {
    if (!canFinish || finishOfferedRef.current) return;
    finishOfferedRef.current = true;
    setFinishBanner(true);
    if (!convoLesson) playSfx('fanfare', 0.7);
  }, [canFinish, convoLesson]);

  // Tick the visible timer once a second while the conversation lesson runs.
  useEffect(() => {
    if (!convoLesson) return;
    const id = setInterval(
      () => setConvoElapsed(Math.floor((Date.now() - convoStartRef.current) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [convoLesson]);

  const authToken = useSettings((s) => s.authToken);
  const audioConsent = useSettings((s) => s.audioConsent);

  const requestHint = useCallback(async () => {
    if (hintLoading) return;
    Haptics.selectionAsync().catch(() => {});
    setHintLoading(true);
    setHint(null);
    try {
      const lastBobo = [...history].reverse().find((t) => t.role === 'bobo');
      const res = await getTalkHint(
        language,
        lessonDay,
        apiLevel,
        childName,
        lastBobo?.text ?? null,
        authToken,
      );
      setHint(res.suggestion);
    } catch {
      setHint(language === 'en' ? 'Try: "I like cats."' : 'Попробуй: "Мне нравится кот."');
    } finally {
      setHintLoading(false);
    }
  }, [history, language, lessonDay, apiLevel, childName, authToken, hintLoading]);

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const playerRef = useRef<AudioPlayer | null>(null);
  const scrollRef = useRef<ScrollViewType>(null);
  // Keyed by the real childId. The old `?? 'guest'` fallback collapsed every
  // signed-out device onto one shared key (`guest-d1-en`), so guests on the same
  // server instance read each other's conversation turns.
  const conversationId = `${childId}-d${lessonDay}-${language}`;
  const particleIdRef = useRef(0);
  const petRef = useRef<ReactingPetHandle>(null);

  // Report an AI reply as inappropriate/wrong (Google Play GenAI requirement).
  const reportMessage = useCallback((text: string) => {
    const az = parentUILanguage === 'az';
    Haptics.selectionAsync().catch(() => {});
    Alert.alert(
      az ? 'Cavabı bildir?' : 'Пожаловаться на ответ?',
      az
        ? 'Bu cavab uyğun deyil və ya yanlışdır? Bizə bildirin — yoxlayacağıq.'
        : `Ответ ${bot} неуместный или неправильный? Сообщите нам — мы проверим.`,
      [
        { text: az ? 'Ləğv et' : 'Отмена', style: 'cancel' },
        {
          text: az ? 'Bildir' : 'Пожаловаться',
          style: 'destructive',
          onPress: () => {
            reportAiMessage(
              { childId: childId ?? undefined, conversationId, messageText: text, reason: 'inappropriate' },
              authToken,
            ).catch(() => {});
            Alert.alert(
              az ? 'Təşəkkür' : 'Спасибо',
              az ? 'Bildiriş göndərildi.' : 'Жалоба отправлена — мы проверим этот ответ.',
            );
          },
        },
      ],
    );
  }, [parentUILanguage, bot, childId, conversationId, authToken]);

  // Mic level → waveform bridge. Polled (not useAudioRecorderState) so metering
  // updates never re-render the screen — they flow straight into shared values.
  const micLevel = useSharedValue(0);
  const meterDead = useSharedValue(0); // 1 = metering unsupported → canned wave
  const meterTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopMetering = useCallback(() => {
    if (meterTimer.current) {
      clearInterval(meterTimer.current);
      meterTimer.current = null;
    }
    micLevel.value = withTiming(0, { duration: 150 });
  }, [micLevel]);

  const startMetering = useCallback(() => {
    stopMetering();
    let misses = 0;
    meterTimer.current = setInterval(() => {
      let db: number | undefined;
      try {
        db = recorder.getStatus().metering;
      } catch {
        db = undefined;
      }
      // dBFS is ≤ 0; undefined/NaN/positive values mean metering isn't working
      if (typeof db !== 'number' || !Number.isFinite(db) || db > 0) {
        if (++misses >= 8) meterDead.value = 1; // Android fallback → canned wave
        return;
      }
      misses = 0;
      meterDead.value = 0;
      const norm = Math.min(1, Math.max(0, (db + 50) / 42)); // voice ≈ -50..-8 dB
      micLevel.value = withTiming(norm, { duration: 100 });
    }, 100);
  }, [recorder, micLevel, meterDead, stopMetering]);

  useEffect(() => stopMetering, [stopMetering]);

  // Keep latest session id/lang for the unmount flush (language can change mid-session)
  const sessionRef = useRef({ conversationId, language });
  sessionRef.current = { conversationId, language };

  // On leaving the chat, flush memory extraction so short (1-3 turn) sessions
  // still capture events/promises before they could become follow-up threads.
  useEffect(() => {
    return () => {
      const s = useSettings.getState();
      if (!s.childId) return;
      const { conversationId: cid, language: lang } = sessionRef.current;
      postSessionEnd(s.childId, cid, lang, s.childName ?? undefined, s.authToken)
        .then((res) => {
          if (!res?.sensitive) return;
          // Real-time parent alert, throttled to once/day, no details
          const st = useSettings.getState();
          const today = todayISO();
          if (st.lastSensitiveAlertDate === today) return;
          st.setLastSensitiveAlertDate(today);
          notifyParentSensitive(st.parentUILanguage === 'az').catch(() => {});
        })
        .catch(() => {});
    };
  }, []);

  // Load the previous conversation for this child+language (muted recap on top).
  useEffect(() => {
    historyLoadedRef.current = false;
    let alive = true;
    loadTalkHistory(childId, language).then((turns) => {
      if (alive) { setPastTurns(turns); historyLoadedRef.current = true; }
    });
    return () => { alive = false; };
  }, [childId, language]);

  // Persist the live conversation tail so it becomes next session's recap.
  useEffect(() => {
    if (!historyLoadedRef.current || history.length === 0) return;
    saveTalkHistory(
      childId,
      language,
      history.map((t) => ({ role: t.role, text: t.text })),
    );
  }, [history, childId, language]);

  const glowScale = useSharedValue(1);
  useEffect(() => {
    glowScale.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 2000 }), withTiming(1, { duration: 2000 })),
      -1,
      true,
    );
  }, []);
  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
  }));

  useEffect(() => {
    track({ event: 'talk_session_started', userId, childId, props: { lang: language, day: lessonDay } });
    (async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      setPermissionGranted(granted);
      if (granted) {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      }
    })();
    return () => {
      // pause() BEFORE remove(): remove alone can leave a playing channel
      // audible after leaving the screen (voice overlapping the next screen).
      try { playerRef.current?.pause(); } catch { /* already released */ }
      try { playerRef.current?.remove(); } catch { /* already released */ }
      playerRef.current = null;
    };
  }, []);

  const spawnParticles = () => {
    const newParticles: Particle[] = Array.from({ length: 7 }, (_, i) => ({
      id: particleIdRef.current++,
      x: 40 + Math.random() * 200,
      y: 20 + Math.random() * 80,
      delay: i * 80,
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 1200);
  };

  const startRecording = useCallback(async () => {
    // Audio-consent gate: talking sends the child's voice to AI partners. The
    // parent ticks consent on the first onboarding step; a guest now holds a real
    // token, so the gate is on consent alone — checking the token too would let
    // every guest past it.
    if (!audioConsent) {
      const az = parentUILanguage === 'az';
      Alert.alert(
        az ? 'Səs razılığı lazımdır' : 'Нужно согласие на голос',
        az
          ? `${bot} ilə danışmaq üçün səsin AI partnyorlarına göndərilməsinə razılıq lazımdır.`
          : `Чтобы говорить с ${bot}, нужно согласие родителя на отправку голоса AI-партнёрам.`,
        [
          { text: az ? 'Ləğv et' : 'Отмена', style: 'cancel' },
          {
            text: az ? 'Razılıq ver' : 'Дать согласие',
            onPress: () => router.push('/auth/consent' as any),
          },
        ],
      );
      return;
    }
    if (!permissionGranted) {
      Alert.alert(
        'Microphone needed',
        `Söz needs microphone access to talk with ${bot}. Please enable it in Settings.`,
      );
      return;
    }
    if (mood !== 'idle') return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await recorder.prepareToRecordAsync();
      recorder.record();
      startMetering();
      setMood('recording');
    } catch (e) {
      console.warn('record start failed', e);
      stopMetering();
      setMood('idle');
    }
  }, [permissionGranted, mood, recorder, startMetering, stopMetering, authToken, audioConsent, parentUILanguage, bot, router]);

  const stopRecording = useCallback(async () => {
    if (mood !== 'recording') return;
    stopMetering();
    setMood('thinking');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) { setMood('idle'); return; }

      const { base64: audioBase64, mimeType: audioMimeType } = await readAsBase64(uri);

      // childId is always a real profile now — the trial gets a guest ACCOUNT
      // (see services/guestSession) instead of a made-up `guest-<timestamp>` id.
      // That old placeholder never matched a row, so every conversation it
      // produced failed its DB write and lived only in server memory, shared with
      // every other guest on the same instance.
      if (!childId) {
        setMood('idle');
        return;
      }

      const response = await postTalk(
        {
          childId,
          conversationId,
          language,
          audioBase64,
          audioMimeType,
          level: apiLevel,
          day: lessonDay,
          childName: childName ?? undefined,
          ageBand: childAgeBand ?? undefined,
          scenario: params.scenario,
          objectives: goals?.map((g) => g.en),
          companionName: petName ?? undefined,
          // Fallback 'ru': an unset parentUILanguage (fresh install / cleared
          // storage) must never disable mixed-speech understanding.
          nativeLanguage: parentUILanguage === 'az' ? 'az' : 'ru',
          sessionElapsedSec: convoLesson
            ? Math.floor((Date.now() - convoStartRef.current) / 1000)
            : undefined,
          sessionTargetSec: convoLesson ? convoTargetSec : undefined,
        },
        authToken,
      );

      // Diagnostic: log TTS status so you can see in metro logs WHY audio is missing.
      console.log(
        '[talk] response',
        'audioBytes=', response.audioBase64?.length ?? 0,
        'stubbed=', response.ttsStubbed,
        'reason=', response.ttsReason ?? 'ok',
      );

      setLatest(response);
      // Crisis: the server has already emailed the parent and recorded the alert.
      // This is the extra nudge in case the parent is nearby right now.
      if (response.crisis && !crisisNotifiedRef.current) {
        crisisNotifiedRef.current = true;
        notifyParentSensitive(useSettings.getState().parentUILanguage === 'az').catch(() => {});
      }
      setHistory((prev) => [
        ...prev,
        {
          role: 'child',
          text: response.transcript || '...',
          ts: Date.now(),
          unclearWords: response.pronunciationHint?.unclearWords ?? [],
          confidence: response.pronunciationHint?.confidence,
        },
        { role: 'bobo', text: response.responseText, ts: Date.now() + 1 },
      ]);

      spawnParticles();
      playSfx('success', 0.6);
      petRef.current?.react('correct');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

      // Topic checklist: mark newly accomplished goals; celebrate once when all 3 are done
      if (goals?.length && response.objectivesDone?.length) {
        setObjDone((prev) => {
          const next = goals.map((_, i) => prev[i] ?? false);
          for (const idx of response.objectivesDone ?? []) {
            if (idx >= 1 && idx <= next.length) next[idx - 1] = true;
          }
          if (next.every(Boolean) && !allDoneRef.current) {
            allDoneRef.current = true;
            setGoalsBanner(true);
            spawnParticles();
            playSfx('fanfare', 0.7);
          }
          return next;
        });
      }

      // Conversation lesson: Бобо wraps the session up itself when the planned
      // time is done (wrapSuggested). Safety net: if the model never emits the
      // marker, surface the finish banner at 1.5× the target anyway.
      if (convoLesson && !convoDoneRef.current) {
        const elapsedSec = (Date.now() - convoStartRef.current) / 1000;
        if (response.wrapSuggested || elapsedSec >= convoTargetSec * 1.5) {
          convoDoneRef.current = true;
          setWrapUnlocked(true);
          playSfx('fanfare', 0.7);
          spawnParticles();
        }
      }

      if (response.audioBase64) {
        setMood('playing');
        await playAudio(response.audioBase64, response.audioMimeType);
        setMood('idle');
      } else {
        setMood('idle');
      }
    } catch (e) {
      console.warn('talk failed', e);
      if (isRateLimitError(e)) {
        // The daily allowance is used up. This screen is the child's — no
        // upsell here (store policy for kids apps, and simple decency); the
        // parent sees the counter and the Premium button on their own screen.
        const az = useSettings.getState().parentUILanguage === 'az';
        Alert.alert(
          az ? `${bot} yorulub 😴` : `${bot} устал 😴`,
          az
            ? `${bot} bu gün çox danışdı və yatmağa gedir. Sabah davam edərik!`
            : `${bot} сегодня много разговаривал и идёт спать. Продолжим завтра!`,
        );
      } else {
        Alert.alert('Connection issue', `Could not reach ${bot}. Make sure the API is running.`);
      }
      setMood('idle');
    }
  }, [language, mood, recorder, stopMetering, goals, bot]);

  const playAudio = async (base64: string, mimeType: string) => {
    if (!base64) {
      console.warn('[playAudio] empty audio payload — TTS stubbed?');
      return;
    }
    try {
      // 1) Temp file on the phone (data: URIs are unreliable on iOS with
      //    expo-audio's createAudioPlayer), data: URI on the web.
      const { uri: fileUri, cleanup } = await playableAudioUri(base64, mimeType, 'bobo');

      // 2) Switch iOS audio session into PLAYBACK mode so sound is routed
      //    through the speaker (not the earpiece). Without this, audio
      //    played right after recording is nearly inaudible on iPhone.
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });

      // 3) Play and wait for end (pause first — remove alone may not silence)
      try { playerRef.current?.pause(); } catch { /* already released */ }
      playerRef.current?.remove();
      const player = createAudioPlayer({ uri: fileUri });
      playerRef.current = player;
      player.play();
      await new Promise<void>((resolve) => {
        const sub = player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) { sub.remove(); resolve(); }
        });
        // Safety: never hang forever
        setTimeout(() => { sub.remove(); resolve(); }, 30_000);
      });
      player.remove();
      playerRef.current = null;

      // 4) Cleanup temp file (best-effort)
      cleanup();
    } catch (e) {
      console.warn('playback failed', e);
    } finally {
      // 5) Restore recording-enabled mode so the next mic press works
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true })
        .catch(() => {});
    }
  };

  const openerPlayedRef = useRef(false);
  useEffect(() => {
    if (!permissionGranted || openerPlayedRef.current || !childId) return;
    openerPlayedRef.current = true;

    setMood('thinking');
    fetchTalkOpener(childId, language, childName, childAgeBand, apiLevel, authToken, params.threadId ?? null, params.scenario ?? null, petName ?? null)
      .then(async (opener) => {
        console.log('[talk/opener] audioBytes=', opener.audioBase64?.length ?? 0, 'stubbed=', opener.ttsStubbed);
        setHistory([{ role: 'bobo', text: opener.text, ts: Date.now() }]);
        if (opener.audioBase64) {
          setMood('playing');
          await playAudio(opener.audioBase64, opener.audioMimeType);
        }
        setMood('idle');
        // Now that the child actually heard the callback, mark the thread asked
        if (opener.thread?.id) markThreadAsked(opener.thread.id, authToken).catch(() => {});
      })
      .catch(() => {
        setMood('idle');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionGranted]);

  const switchLanguage = () => {
    if (!canSwitchLang) return;
    Haptics.selectionAsync().catch(() => {});
    setLanguage((prev) => {
      const other = learningLanguages.find((l) => l !== prev);
      return other ?? prev;
    });
    setHistory([]);
    setLatest(null);
  };

  const boboMood = mood === 'thinking' || mood === 'recording' ? 'curious' : 'happy';
  const langConfig = {
    en: { flag: '🇬🇧', label: 'English', color: colors.english },
    ru: { flag: '🇷🇺', label: 'Русский', color: colors.russian },
  }[language];

  const moodLabel = {
    idle: language === 'en' ? 'Hold to talk' : 'Зажми и говори',
    recording: language === 'en' ? 'Listening...' : 'Слушаю...',
    thinking: language === 'en' ? `${bot} is thinking...` : `${bot} думает...`,
    playing: language === 'en' ? `${bot} is talking` : `${bot} говорит`,
  }[mood];

  const statusDotColor = mood === 'recording' ? colors.berry : mood === 'thinking' ? colors.butter : colors.accent;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PaperBackground>
        <View style={styles.container}>
          {/* ── Header ── */}
          <View style={styles.header}>
            {/* Выход. В уроке это «×» — уйти без награды; засчитывает урок только
                «Завершить урок» после настоящего разговора (раньше тут стояла «✓»,
                которая засчитывала урок без единого слова). */}
            <Pressable
              onPress={() => router.replace('/home')}
              accessibilityRole="button"
              accessibilityLabel={parentUILanguage === 'az' ? 'Çıx' : 'Выйти'}
              style={[styles.homeBtn, shadow.sm]}
            >
              <Icon name={fromLesson ? 'x' : 'chevron-left'} size={20} color={colors.ink} strokeWidth={2.5} />
            </Pressable>

            <Animated.View style={[styles.headerCenter, glowStyle]}>
              <Animated.View style={[styles.petAvatar, shadow.sm]}>
                <ReactingPet ref={petRef} size={32} eyes={false} mood={boboMood === 'happy' ? 'happy' : 'curious'} talking={mood === 'playing'} />
              </Animated.View>
              <View style={{ minWidth: 0 }}>
                <Text style={styles.headerName}>{bot}</Text>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
                  <Text style={styles.statusText}>{moodLabel}</Text>
                </View>
              </View>
            </Animated.View>

            <Pressable
              onPress={switchLanguage}
              disabled={!canSwitchLang}
              style={[styles.langPill, !canSwitchLang && { opacity: 0.7 }, shadow.sm]}
            >
              <Text style={{ fontSize: fontSize.sm }}>{langConfig.flag}</Text>
              <Text style={styles.langLabel}>{language.toUpperCase()}</Text>
            </Pressable>
          </View>

          {/* ── Conversation-lesson progress (time bar toward the finish) ── */}
          {canFinish && !finishBanner ? (
            <View style={styles.finishRow}>
              <HBButton
                size="sm"
                icon="circle-check"
                label={parentUILanguage === 'az' ? 'Dərsi bitir' : 'Завершить урок'}
                onPress={finishLesson}
              />
            </View>
          ) : fromLesson && !convoLesson ? (
            <View style={styles.convoProgress}>
              <View style={styles.convoBarTrack}>
                <View
                  style={[
                    styles.convoBarFill,
                    { width: `${Math.min(100, (spoken / MIN_LESSON_TALK_TURNS) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.convoProgressText}>
                {parentUILanguage === 'az'
                  ? `Deyilən cümlə: ${Math.min(spoken, MIN_LESSON_TALK_TURNS)} / ${MIN_LESSON_TALK_TURNS}`
                  : `Фраз сказано: ${Math.min(spoken, MIN_LESSON_TALK_TURNS)} из ${MIN_LESSON_TALK_TURNS}`}
              </Text>
            </View>
          ) : convoLesson && !finishBanner ? (
            <View style={styles.convoProgress}>
              <View style={styles.convoBarTrack}>
                <View
                  style={[
                    styles.convoBarFill,
                    { width: `${Math.min(100, (convoElapsed / convoTargetSec) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.convoProgressText}>
                {convoElapsed < 5
                  ? (language === 'en' ? `Chat with ${bot}` : parentUILanguage === 'az' ? `${bot} ilə söhbət` : `Поболтай с ${bot}`)
                  : formatMinSec(convoElapsed)}
              </Text>
            </View>
          ) : null}

          {/* ── Topic goals checklist ── */}
          {goals?.length ? (
            <ObjectiveChips
              labels={goals.map((g) => (parentUILanguage === 'az' ? g.az : g.ru))}
              done={objDone}
            />
          ) : null}

          {/* ── All goals done banner ── */}
          {goalsBanner ? (
            <Animated.View entering={FadeInDown.duration(400).springify()} style={[styles.goalsBanner, shadow.md]}>
              <Text style={styles.goalsBannerTitle}>
                {parentUILanguage === 'az' ? '🎉 Bütün məqsədlər yerinə yetirildi!' : '🎉 Все цели выполнены!'}
              </Text>
              <View style={styles.goalsBannerRow}>
                <Pressable onPress={() => setGoalsBanner(false)} style={styles.goalsBannerBtn}>
                  <Text style={styles.goalsBannerBtnText}>
                    {parentUILanguage === 'az' ? 'Davam edək?' : 'Ещё поговорим?'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setGoalsBanner(false); router.replace('/home'); }}
                  style={[styles.goalsBannerBtn, styles.goalsBannerBtnPrimary]}
                >
                  <Text style={[styles.goalsBannerBtnText, { color: colors.white }]}>
                    {parentUILanguage === 'az' ? 'Hazır ✓' : 'Готово ✓'}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : null}

          {/* ── Conversation-lesson finish banner ── */}
          {finishBanner ? (
            <Animated.View entering={FadeInDown.duration(400).springify()} style={[styles.goalsBanner, shadow.md]}>
              <Text style={styles.goalsBannerTitle}>
                {parentUILanguage === 'az' ? `🎉 ${bot} ilə əla söhbət!` : `🎉 Отличная беседа с ${bot}!`}
              </Text>
              <View style={styles.goalsBannerRow}>
                <Pressable onPress={() => setFinishBanner(false)} style={styles.goalsBannerBtn}>
                  <Text style={styles.goalsBannerBtnText}>
                    {parentUILanguage === 'az' ? 'Bir az da' : 'Ещё немного'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={finishLesson}
                  style={[styles.goalsBannerBtn, styles.goalsBannerBtnPrimary]}
                >
                  <Text style={[styles.goalsBannerBtnText, { color: colors.white }]}>
                    {parentUILanguage === 'az' ? 'Bitir ✓' : 'Завершить ✓'}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : null}

          {/* particle layer */}
          <View pointerEvents="none" style={styles.particleLayer}>
            {particles.map((p) => (
              <StarParticle key={p.id} x={p.x} y={p.y} delay={p.delay} />
            ))}
          </View>

          {/* ── Chat history ── */}
          <ScrollView
            ref={scrollRef}
            style={styles.history}
            contentContainerStyle={styles.historyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Previous conversation recap — proof that Бобо remembers */}
            {pastTurns.length > 0 ? (
              <View style={styles.pastWrap}>
                <View style={styles.pastDivider}>
                  <View style={styles.pastLine} />
                  <Text style={styles.pastLabel}>
                    {parentUILanguage === 'az' ? `${bot} xatırlayır` : `${bot} помнит`}
                  </Text>
                  <View style={styles.pastLine} />
                </View>
                {pastTurns.map((t, i) => (
                  <View
                    key={`past-${i}`}
                    style={t.role === 'bobo' ? styles.boboRow : styles.childRow}
                  >
                    {t.role === 'bobo' ? (
                      <>
                        <HBPet size={28} eyes={false} mood="happy" still />
                        <View style={[styles.bubble, styles.bubbleBobo, styles.bubblePast]}>
                          <Text style={[styles.bubbleText, styles.bubblePastText]}>{t.text}</Text>
                        </View>
                      </>
                    ) : (
                      <View style={[styles.bubble, styles.bubbleChild, styles.bubbleChildPast]}>
                        <Text style={[styles.bubbleText, styles.bubblePastText]}>{t.text}</Text>
                      </View>
                    )}
                  </View>
                ))}
                <View style={styles.pastDivider}>
                  <View style={styles.pastLine} />
                  <Text style={styles.pastLabel}>
                    {parentUILanguage === 'az' ? 'Bu gün' : 'Сегодня'}
                  </Text>
                  <View style={styles.pastLine} />
                </View>
              </View>
            ) : null}

            {history.length === 0 ? (
              <Animated.View entering={FadeIn.duration(500)} style={styles.emptyState}>
                <HBPet size={88} mood="happy" />
                <Text style={styles.emptyText}>
                  {language === 'en'
                    ? `Press and hold the mic to talk to ${bot} ✨`
                    : `Зажми микрофон чтобы поговорить с ${bot} ✨`}
                </Text>
              </Animated.View>
            ) : null}

            {history.map((turn, i) => (
              <Animated.View
                key={`${turn.ts}-${i}`}
                entering={turn.role === 'bobo' ? FadeInDown.duration(350).springify() : FadeInUp.duration(300)}
                style={turn.role === 'bobo' ? styles.boboRow : styles.childRow}
              >
                {turn.role === 'bobo' ? (
                  <>
                    <HBPet size={36} eyes={false} mood="happy" />
                    <View style={[styles.bubble, styles.bubbleBobo, shadow.sm]}>
                      <Text style={styles.bubbleText}>{turn.text}</Text>
                      <View style={styles.bubbleTailBobo} />
                    </View>
                    <Pressable
                      onPress={() => reportMessage(turn.text)}
                      hitSlop={10}
                      style={styles.reportBtn}
                    >
                      <Text style={styles.reportIcon}>⚐</Text>
                    </Pressable>
                  </>
                ) : (
                  <View style={[styles.bubble, styles.bubbleChild]}>
                    <ChildTranscript text={turn.text} unclearWords={turn.unclearWords ?? []} />
                    {typeof turn.confidence === 'number' && turn.confidence < 0.7 && turn.unclearWords && turn.unclearWords.length > 0 && (
                      <View style={styles.pronChip}>
                        <Text style={styles.pronChipText}>
                          {language === 'en' ? '🎯 Try again clearly' : '🎯 Скажи чётче'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.bubbleTailChild} />
                  </View>
                )}
              </Animated.View>
            ))}

            {mood === 'thinking' && (
              <Animated.View
                entering={FadeIn.duration(300)}
                exiting={FadeOut.duration(200)}
                style={styles.boboRow}
              >
                <HBPet size={36} eyes={false} mood="curious" />
                <View style={[styles.bubble, styles.bubbleBobo, styles.thinkingBubble, shadow.sm]}>
                  <Text style={{ fontSize: 20 }}>💭</Text>
                  <Text style={styles.bubbleText}>
                    {language === 'en' ? 'thinking...' : 'думаю...'}
                  </Text>
                </View>
              </Animated.View>
            )}
          </ScrollView>

          {/* ── Hint pill (when idle) ── */}
          {mood === 'idle' && (
            <View style={styles.hintRow}>
              {hint ? (
                <Animated.View entering={FadeIn.duration(300)} style={[styles.hintBubble, shadow.sm]}>
                  <Text style={styles.hintLabelText}>💡</Text>
                  <Text style={styles.hintText}>{hint}</Text>
                  <Pressable onPress={() => setHint(null)} hitSlop={8}>
                    <Text style={styles.hintClose}>✕</Text>
                  </Pressable>
                </Animated.View>
              ) : (
                <Pressable
                  onPress={requestHint}
                  disabled={hintLoading}
                  style={[styles.hintBtn, shadow.sm, hintLoading && { opacity: 0.6 }]}
                >
                  <Text style={styles.hintBtnText}>
                    {hintLoading
                      ? (language === 'en' ? 'Thinking…' : 'Думаю…')
                      : (language === 'en' ? '💡 Need a hint?' : '💡 Нужна подсказка?')}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* ── Mic area ── */}
          <View style={styles.micArea}>
            {latest ? (
              <HBChip
                label={`${latest.timings.sttMs + latest.timings.llmMs + latest.timings.ttsMs}ms`}
                bg="rgba(255,255,255,0.5)"
                style={{ alignSelf: 'center', marginBottom: spacing[2] }}
              />
            ) : null}
            {mood === 'recording' && (
              <Animated.View
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
                style={styles.waveformOverlay}
                pointerEvents="none"
              >
                <MicWaveform level={micLevel} dead={meterDead} />
              </Animated.View>
            )}
            <MicButton
              state={mood}
              onPressIn={startRecording}
              onPressOut={stopRecording}
              disabled={mood === 'thinking' || mood === 'playing'}
            />
          </View>

          {!fromLesson && <BottomTabs />}
        </View>
      </PaperBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: spacing[4],
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingBottom: spacing[2],
  },
  homeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
    minWidth: 0,
  },
  petAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize['2xs'],
    color: colors.inkSoft,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.card,
    paddingHorizontal: spacing[2],
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  langLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['2xs'],
    color: colors.ink,
    letterSpacing: 0.5,
  },

  particleLayer: { ...StyleSheet.absoluteFillObject, zIndex: 5 },

  history: { flex: 1 },
  historyContent: {
    paddingVertical: spacing[3],
    gap: spacing[3],
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
  },
  emptyText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 20,
  },

  boboRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
  },
  childRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  bubble: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    maxWidth: '78%',
    position: 'relative',
  },
  bubbleBobo: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
    flex: 1,
  },
  bubbleChild: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
    borderBottomWidth: 3,
    borderBottomColor: colors.primaryDeep,
  },
  bubbleText: {
    color: colors.ink,
    fontFamily: fontFamily.bodyBold,
    fontSize: scaleFont(15),
    lineHeight: 21,
  },
  unclearWord: {
    // Underline + tinted background — kid-friendly way to flag "say this clearer"
    backgroundColor: 'rgba(229,92,115,0.18)',
    color: '#B73E55',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textDecorationColor: '#B73E55',
    borderRadius: 3,
  },
  pronChip: {
    marginTop: spacing[2],
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(229,92,115,0.12)',
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
  },
  pronChipText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize['2xs'],
    color: '#B73E55',
  },
  bubbleTailBobo: {
    position: 'absolute',
    bottom: 6,
    left: -6,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: colors.card,
  },
  bubbleTailChild: {
    position: 'absolute',
    bottom: 6,
    right: -6,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.primary,
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    opacity: 0.9,
  },
  reportBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  reportIcon: {
    fontSize: fontSize.caption,
    color: colors.inkSoft,
    opacity: 0.45,
  },

  // Previous-conversation recap (muted)
  pastWrap: { gap: spacing[3], opacity: 0.6 },
  pastDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
  pastLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  pastLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['3xs'],
    color: colors.inkSoft,
    letterSpacing: 0.6,
  },
  bubblePast: {
    backgroundColor: colors.bgDeep,
  },
  bubblePastText: {
    color: colors.inkSoft,
    fontFamily: fontFamily.bodyMedium,
  },
  bubbleChildPast: {
    backgroundColor: colors.primarySoft,
    borderBottomColor: colors.primary,
  },

  micArea: {
    alignItems: 'center',
    paddingBottom: spacing[6],
    paddingTop: spacing[2],
  },
  waveformOverlay: {
    // Sits in the dead space above the 110px mic button inside its 200px wrapper
    position: 'absolute',
    bottom: 186,
    alignSelf: 'center',
    zIndex: 5,
  },
  goalsBanner: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing[3],
    marginTop: spacing[2],
    gap: spacing[2],
    borderWidth: 2,
    borderColor: colors.accent,
  },
  goalsBannerTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: colors.ink,
    textAlign: 'center',
  },
  goalsBannerRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  goalsBannerBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
  },
  goalsBannerBtnPrimary: {
    backgroundColor: colors.accent,
  },
  goalsBannerBtnText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.sm,
    color: colors.ink,
  },

  finishRow: {
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  convoProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: spacing[1],
  },
  convoBarTrack: {
    flex: 1,
    maxWidth: 160,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  convoBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  convoProgressText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize['2xs'],
    color: colors.inkSoft,
    marginLeft: spacing[1],
  },

  hintRow: {
    paddingBottom: spacing[2],
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintBtn: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  hintBtnText: {
    color: colors.ink,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.caption,
  },
  hintBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.butter,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    maxWidth: '90%',
  },
  hintLabelText: { fontSize: fontSize.base },
  hintText: {
    flex: 1,
    color: colors.ink,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.caption,
  },
  hintClose: {
    color: colors.ink,
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.sm,
    paddingHorizontal: 4,
  },
});
