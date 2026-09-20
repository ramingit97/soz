/**
 * «Говорить» — разговор с персонажем.
 *
 * Шапка: выход, персонаж со статусом («слушаю», «думаю», «говорю»), язык.
 * Пузыри: персонаж — белый, ребёнок — мягкий цвет питомца с тёмным текстом.
 * Внизу подсказка и микрофон. Ошибки, лимит и нужное согласие — полоской над
 * микрофоном (`InlineBanner`), а не системным диалогом.
 */

import { playableAudioUri } from '@/utils/recording';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
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
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BottomTabs, BottomTabsSpacer } from '@/components/BottomTabs';
import { HBCard } from '@/components/HBCard';
import { HBChip } from '@/components/HBChip';
import { HBIconBox } from '@/components/HBIconBox';
import { HBPet } from '@/components/HBPet';
import { InlineBanner } from '@/components/InlineBanner';
import { MicButton } from '@/components/MicButton';
import { MicWaveform } from '@/components/MicWaveform';
import { ObjectiveChips } from '@/components/ObjectiveChips';
import { PaperBackground } from '@/components/PaperBackground';
import { ReactingPet, type ReactingPetHandle } from '@/components/ReactingPet';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StarParticle } from '@/components/StarParticle';
import { Text } from '@/components/Text';
import { TypingDots } from '@/components/TypingDots';
import { useTheme } from '@/hooks/useTheme';
import { useUIMode } from '@/hooks/useUIMode';
import { track } from '@/services/analytics';
import { fetchTalkOpener, getTalkHint, markThreadAsked, postSessionEnd, postTalk, reportAiMessage, type TalkResponsePayload } from '@/services/api';
import { notifyParentSensitive } from '@/services/notifications';
import { playSfx } from '@/services/sfx';
import { loadTalkHistory, saveTalkHistory, type StoredTurn } from '@/services/talkHistory';
import { useSettings, todayISO } from '@/store/settings';
import { fontFamily, fontSize, radius, scaleFont, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';
import { talkFailureMessage, type TalkFailureMessage } from '@/utils/talkAlert';
import { canFinishTalkLesson, MIN_LESSON_TALK_TURNS, spokenTurns } from '@/utils/lessonTalk';
import { HBButton } from '@/components/HBButton';
import { Icon } from '@/components/Icon';
import type { LanguageCode } from '@soz/shared-types';
import { makeModeStyles } from '@/theme/modeTokens';

declare const __DEV__: boolean;

type Mood = 'idle' | 'recording' | 'thinking' | 'playing';

/** Что сейчас сказать полоской над микрофоном. */
type Banner =
  | { kind: 'failure'; msg: TalkFailureMessage }
  | { kind: 'consent' }
  | { kind: 'mic' }
  | { kind: 'reported' };

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
  const { mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
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
  // Разговор на выбранную тему — для 11+ и вне урока (у малышей тему ведёт урок).
  const showTopics = useUIMode() === 'teen' && !fromLesson;
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
  const [banner, setBanner] = useState<Banner | null>(null);
  const { c, mode: uiMode, t, accent } = useTheme();
  const styles = stylesByMode[uiMode];

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

  const voice = useVoiceRecorder();
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
            setBanner({ kind: 'reported' });
          },
        },
      ],
    );
  }, [parentUILanguage, bot, childId, conversationId, authToken]);

  // Mic level → waveform bridge. The recorder hook reports levels through a
  // callback straight into shared values, so metering never re-renders the screen.
  const micLevel = useSharedValue(0);
  const meterDead = useSharedValue(0); // 1 = no level yet / metering unsupported → canned wave
  const resetLevel = useCallback(() => {
    micLevel.value = withTiming(0, { duration: 150 });
  }, [micLevel]);
  const onLevel = useCallback((level: number) => {
    meterDead.value = 0;
    micLevel.value = withTiming(level, { duration: 100 });
  }, [micLevel, meterDead]);



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
      setBanner({ kind: 'consent' });
      return;
    }
    if (!permissionGranted) {
      setBanner({ kind: 'mic' });
      return;
    }
    if (mood !== 'idle') return;
    setBanner(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      meterDead.value = 1;
      setMood('recording');
      // Запись останавливается сама, когда ребёнок замолчал (ref — чтобы
      // автостоп вызвал свежую stopRecording, а не версию с mood 'idle').
      await voice.start({ onAutoStop: () => stopRecordingRef.current?.(), onLevel });
    } catch (e) {
      console.warn('record start failed', e);
      resetLevel();
      setMood('idle');
    }
  }, [permissionGranted, mood, voice, onLevel, resetLevel, meterDead, audioConsent]);

  const stopRecording = useCallback(async () => {
    if (mood !== 'recording') return;
    resetLevel();
    setMood('thinking');
    try {
      const audio = await voice.stop();
      if (!audio) { setMood('idle'); return; }
      const { base64: audioBase64, mimeType: audioMimeType } = audio;

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
      setBanner({ kind: 'failure', msg: talkFailureMessage(e, bot) });
      setMood('idle');
    }
  }, [language, mood, voice, resetLevel, goals, bot]);

  const stopRecordingRef = useRef<(() => void) | null>(null);
  stopRecordingRef.current = () => { void stopRecording(); };
  const handleMicPress = useCallback(() => {
    if (mood === 'recording') void stopRecording();
    else void startRecording();
  }, [mood, startRecording, stopRecording]);

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

  const az = parentUILanguage === 'az';
  // Лицо персонажа повторяет, что происходит: слушает запись, думает над ответом.
  const boboMood = mood === 'recording' ? 'listening' : mood === 'thinking' ? 'thinking' : 'happy';

  const moodLabel = {
    idle: language === 'en' ? 'Tap to talk' : 'Нажми и говори',
    recording: language === 'en' ? 'Listening...' : 'Слушаю...',
    thinking: language === 'en' ? `${bot} is thinking...` : `${bot} думает...`,
    playing: language === 'en' ? `${bot} is talking` : `${bot} говорит`,
  }[mood];

  const statusDotColor = mood === 'recording' ? c.berry : mood === 'thinking' ? c.butterDeep : accent.bottom;

  const bannerView = (() => {
    if (!banner) return null;
    const close = () => setBanner(null);
    const closeLabel = az ? 'Bağla' : 'Закрыть';
    switch (banner.kind) {
      case 'failure':
        return (
          <InlineBanner
            tone={banner.msg.tone}
            icon={banner.msg.icon}
            title={banner.msg.title}
            text={banner.msg.text}
            onClose={close}
            closeLabel={closeLabel}
          />
        );
      case 'consent':
        return (
          <InlineBanner
            tone="warning"
            icon="lock"
            title={az ? 'Səs razılığı lazımdır' : 'Нужно согласие на голос'}
            text={
              az
                ? `${bot} ilə danışmaq üçün valideyn səsin AI partnyorlarına göndərilməsinə razılıq verməlidir.`
                : `Чтобы говорить с ${bot}, родитель должен согласиться на отправку голоса AI-партнёрам.`
            }
            action={{ label: az ? 'Razılıq ver' : 'Дать согласие', onPress: () => router.push('/auth/consent' as any) }}
            onClose={close}
            closeLabel={closeLabel}
          />
        );
      case 'mic':
        return (
          <InlineBanner
            tone="danger"
            icon="mic-off"
            title={az ? 'Mikrofon bağlıdır' : 'Микрофон выключен'}
            text={
              az
                ? `${bot} səni eşitsin deyə, telefon ayarlarında Söz üçün mikrofona icazə ver.`
                : `Чтобы ${bot} тебя слышал, разреши Söz доступ к микрофону в настройках телефона.`
            }
            onClose={close}
            closeLabel={closeLabel}
          />
        );
      case 'reported':
        return (
          <InlineBanner
            tone="success"
            text={az ? 'Bildiriş göndərildi — bu cavabı yoxlayacağıq.' : 'Жалоба отправлена — мы проверим этот ответ.'}
            onClose={close}
            closeLabel={closeLabel}
          />
        );
    }
  })();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PaperBackground>
        {/* Выход. В уроке это «×» — уйти без награды; засчитывает урок только
            «Завершить урок» после настоящего разговора (раньше тут стояла «✓»,
            которая засчитывала урок без единого слова). */}
        <ScreenHeader
          backIcon={fromLesson ? 'x' : 'chevron-left'}
          backLabel={az ? 'Çıx' : 'Выйти'}
          onBack={() => router.replace('/home')}
          center={
            <View style={styles.headerCenter}>
              <View style={[styles.petAvatar, { backgroundColor: accent.soft }]}>
                <ReactingPet
                  ref={petRef}
                  size={38}
                  still={false}
                  idleGestures={false}
                  mood={boboMood}
                  talking={mood === 'playing'}
                />
              </View>
              <View style={styles.headerText}>
                <Text variant="headline" numberOfLines={1} style={styles.headerName}>
                  {bot}
                </Text>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {moodLabel}
                  </Text>
                </View>
              </View>
            </View>
          }
          right={
            <Pressable
              onPress={switchLanguage}
              disabled={!canSwitchLang}
              accessibilityRole="button"
              accessibilityLabel={az ? 'Dil' : 'Язык'}
              style={styles.langPill}
            >
              <Icon name="globe" size={14} color={c.inkSoft} strokeWidth={2.25} />
              <Text style={styles.langLabel}>{language.toUpperCase()}</Text>
            </Pressable>
          }
        />

        <View style={[styles.container, { paddingHorizontal: t.density.padX }]}>
          {/* ── Прогресс урока: фразы или время ── */}
          {canFinish && !finishBanner ? (
            <View style={styles.finishRow}>
              <HBButton
                size="sm"
                icon="circle-check"
                label={az ? 'Dərsi bitir' : 'Завершить урок'}
                onPress={finishLesson}
              />
            </View>
          ) : fromLesson && !convoLesson ? (
            <View style={styles.convoProgress}>
              <View style={styles.convoBarTrack}>
                <View
                  style={[
                    styles.convoBarFill,
                    { backgroundColor: accent.bottom, width: `${Math.min(100, (spoken / MIN_LESSON_TALK_TURNS) * 100)}%` },
                  ]}
                />
              </View>
              <Text variant="caption" tone="secondary">
                {az
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
                    { backgroundColor: accent.bottom, width: `${Math.min(100, (convoElapsed / convoTargetSec) * 100)}%` },
                  ]}
                />
              </View>
              <Text variant="caption" tone="secondary">
                {convoElapsed < 5
                  ? (language === 'en' ? `Chat with ${bot}` : az ? `${bot} ilə söhbət` : `Поболтай с ${bot}`)
                  : formatMinSec(convoElapsed)}
              </Text>
            </View>
          ) : null}

          {/* ── Цели темы ── */}
          {goals?.length ? (
            <ObjectiveChips
              labels={goals.map((g) => (az ? g.az : g.ru))}
              done={objDone}
            />
          ) : null}

          {/* ── Все цели темы выполнены ── */}
          {goalsBanner ? (
            <Celebration
              title={az ? 'Bütün məqsədlər yerinə yetirildi!' : 'Все цели выполнены!'}
              stayLabel={az ? 'Davam edək' : 'Ещё поговорим'}
              doneLabel={az ? 'Hazır' : 'Готово'}
              onStay={() => setGoalsBanner(false)}
              onDone={() => { setGoalsBanner(false); router.replace('/home'); }}
            />
          ) : null}

          {/* ── Урок-разговор можно завершить ── */}
          {finishBanner ? (
            <Celebration
              title={az ? `${bot} ilə əla söhbət!` : `Отличная беседа с ${bot}!`}
              stayLabel={az ? 'Bir az da' : 'Ещё немного'}
              doneLabel={az ? 'Dərsi bitir' : 'Завершить урок'}
              onStay={() => setFinishBanner(false)}
              onDone={finishLesson}
            />
          ) : null}

          {/* particle layer */}
          <View pointerEvents="none" style={styles.particleLayer}>
            {particles.map((p) => (
              <StarParticle key={p.id} x={p.x} y={p.y} delay={p.delay} />
            ))}
          </View>

          {/* ── Переписка ── */}
          <ScrollView
            ref={scrollRef}
            style={styles.history}
            contentContainerStyle={styles.historyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Прошлый разговор приглушённо сверху — видно, что персонаж помнит */}
            {pastTurns.length > 0 ? (
              <View style={styles.pastWrap}>
                <Divider label={az ? `${bot} xatırlayır` : `${bot} помнит`} />
                {pastTurns.map((turn, i) => (
                  <View key={`past-${i}`} style={turn.role === 'bobo' ? styles.boboRow : styles.childRow}>
                    {turn.role === 'bobo' ? (
                      <>
                        <HBPet size={28} mood="happy" still />
                        <View style={[styles.bubble, styles.bubbleBobo]}>
                          <Text style={[styles.bubbleText, styles.bubblePastText]}>{turn.text}</Text>
                        </View>
                      </>
                    ) : (
                      <View style={[styles.bubble, styles.bubbleChild, { backgroundColor: accent.soft }]}>
                        <Text style={[styles.bubbleText, styles.bubblePastText]}>{turn.text}</Text>
                      </View>
                    )}
                  </View>
                ))}
                <Divider label={az ? 'Bu gün' : 'Сегодня'} />
              </View>
            ) : null}

            {history.length === 0 ? (
              <Animated.View entering={FadeIn.duration(500)} style={styles.emptyState}>
                <HBPet size={Math.round(t.mascot.hero * 0.75)} mood={boboMood} talking={mood === 'playing'} />
                <Text variant="bodyBold" tone="secondary" align="center" style={styles.emptyText}>
                  {language === 'en'
                    ? `Tap the mic and talk to ${bot}`
                    : `Нажми на микрофон и поговори с ${bot}`}
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
                    <HBPet size={32} mood="happy" still />
                    <View style={[styles.bubble, styles.bubbleBobo]}>
                      <Text style={styles.bubbleText}>{turn.text}</Text>
                    </View>
                    <Pressable
                      onPress={() => reportMessage(turn.text)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={az ? 'Cavabı bildir' : 'Пожаловаться на ответ'}
                      style={styles.reportBtn}
                    >
                      <Icon name="flag" size={14} color={c.textMuted} strokeWidth={2} />
                    </Pressable>
                  </>
                ) : (
                  <View style={[styles.bubble, styles.bubbleChild, { backgroundColor: accent.soft }]}>
                    <ChildTranscript text={turn.text} unclearWords={turn.unclearWords ?? []} />
                    {typeof turn.confidence === 'number' && turn.confidence < 0.7 && turn.unclearWords && turn.unclearWords.length > 0 && (
                      <View style={styles.pronChip}>
                        <Icon name="target" size={12} color={c.berryDeep} strokeWidth={2.5} />
                        <Text style={styles.pronChipText}>
                          {language === 'en' ? 'Try again clearly' : 'Скажи чётче'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </Animated.View>
            ))}

            {mood === 'thinking' && history.length > 0 && (
              <Animated.View
                entering={FadeIn.duration(300)}
                exiting={FadeOut.duration(200)}
                style={styles.boboRow}
              >
                <HBPet size={32} mood="thinking" still />
                <View
                  style={[styles.bubble, styles.bubbleBobo, styles.thinkingBubble]}
                  accessibilityLabel={language === 'en' ? 'thinking' : 'думаю'}
                >
                  <TypingDots color={c.inkSoft} size={8} />
                </View>
              </Animated.View>
            )}
          </ScrollView>

          {bannerView ? <View style={styles.bannerRow}>{bannerView}</View> : null}

          {/* ── Подсказка (пока тишина) ── */}
          {mood === 'idle' && !bannerView && (
            <View style={styles.hintRow}>
              {hint ? (
                <Animated.View entering={FadeIn.duration(300)} style={styles.hintBubble}>
                  <Icon name="lightbulb" size={18} color="#7F6628" />
                  <Text style={styles.hintText}>{hint}</Text>
                  <Pressable
                    onPress={() => setHint(null)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={az ? 'Bağla' : 'Закрыть'}
                  >
                    <Icon name="x" size={16} color={c.inkSoft} />
                  </Pressable>
                </Animated.View>
              ) : (
                <View style={styles.hintPills}>
                  <Pressable
                    onPress={requestHint}
                    disabled={hintLoading}
                    accessibilityRole="button"
                    style={[styles.hintBtn, hintLoading && { opacity: 0.6 }]}
                  >
                    <Icon name="lightbulb" size={16} color={accent.ink} />
                    <Text style={styles.hintBtnText}>
                      {hintLoading
                        ? (language === 'en' ? 'Thinking…' : 'Думаю…')
                        : showTopics
                          ? (language === 'en' ? 'Hint' : 'Подсказка')
                          : (language === 'en' ? 'Need a hint?' : 'Нужна подсказка?')}
                    </Text>
                  </Pressable>
                  {showTopics ? (
                    <Pressable
                      onPress={() => router.push('/topics' as never)}
                      accessibilityRole="button"
                      style={styles.hintBtn}
                    >
                      <Icon name="sparkles" size={16} color={accent.ink} />
                      <Text style={styles.hintBtnText}>{language === 'en' ? 'Topic' : 'Тема'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>
          )}

          {/* ── Микрофон ── */}
          <View style={styles.micArea}>
            {__DEV__ && latest ? (
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
              onPress={handleMicPress}
              disabled={mood === 'thinking' || mood === 'playing'}
              accessibilityLabel={moodLabel}
            />
          </View>
          {/* Место под плавающие вкладки — иначе они закрывали половину микрофона. */}
          {!fromLesson && <BottomTabsSpacer />}
        </View>

        {!fromLesson && <BottomTabs />}
      </PaperBackground>
    </>
  );
}

function Divider({ label }: { label: string }) {
  const { mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  return (
    <View style={styles.pastDivider}>
      <View style={styles.pastLine} />
      <Text style={styles.pastLabel}>{label}</Text>
      <View style={styles.pastLine} />
    </View>
  );
}

/** Карточка «получилось»: остаться в разговоре или закончить. */
function Celebration({
  title,
  stayLabel,
  doneLabel,
  onStay,
  onDone,
}: {
  title: string;
  stayLabel: string;
  doneLabel: string;
  onStay: () => void;
  onDone: () => void;
}) {
  const { mode: uiMode, accent } = useTheme();
  const styles = stylesByMode[uiMode];
  return (
    <Animated.View entering={FadeInDown.duration(400).springify()}>
      <HBCard style={styles.celebration}>
        <View style={styles.celebrationHead}>
          <HBIconBox icon="party-popper" tint={accent.soft} iconColor={accent.ink} size={40} />
          <Text variant="bodyBold" style={styles.celebrationTitle}>
            {title}
          </Text>
        </View>
        <View style={styles.celebrationRow}>
          <HBButton size="sm" variant="soft" label={stayLabel} onPress={onStay} style={styles.celebrationBtn} />
          <HBButton size="sm" icon="circle-check" label={doneLabel} onPress={onDone} style={styles.celebrationBtn} />
        </View>
      </HBCard>
    </Animated.View>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  container: {
    flex: 1,
  },

  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minWidth: 0,
  },
  petAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { fontSize: fontSize.lg, lineHeight: Math.round(fontSize.lg * 1.25) },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: t.c.surface,
    borderWidth: 1,
    borderColor: t.c.surfaceBorder,
    paddingHorizontal: spacing[2],
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  langLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xs,
    color: t.c.ink,
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
  emptyText: { maxWidth: 260 },

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
    maxWidth: '80%',
  },
  bubbleBobo: {
    backgroundColor: t.c.surface,
    borderWidth: 1,
    borderColor: t.c.surfaceBorder,
    borderBottomLeftRadius: 6,
    flexShrink: 1,
  },
  bubbleChild: {
    borderBottomRightRadius: 6,
  },
  bubbleText: {
    color: t.c.ink,
    fontFamily: fontFamily.bodyBold,
    fontSize: scaleFont(15),
    lineHeight: 21,
  },
  unclearWord: {
    // Подчёркнутое слово на розовом — «скажи это чётче», по-детски понятно
    backgroundColor: 'rgba(229,92,115,0.18)',
    color: t.c.berryDeep,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textDecorationColor: t.c.berryDeep,
    borderRadius: 3,
  },
  pronChip: {
    marginTop: spacing[2],
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: t.c.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
  },
  pronChipText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize['2xs'],
    color: t.c.berryDeep,
  },
  thinkingBubble: {
    paddingVertical: spacing[3],
  },
  reportBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 2,
    paddingBottom: 6,
  },

  // Прошлый разговор (приглушённо)
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
    backgroundColor: t.c.border,
  },
  pastLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['3xs'],
    color: t.c.inkSoft,
    letterSpacing: 0.6,
  },
  bubblePastText: {
    color: t.c.inkSoft,
    fontFamily: fontFamily.bodyMedium,
  },

  bannerRow: { paddingBottom: spacing[2] },

  micArea: {
    alignItems: 'center',
    paddingBottom: spacing[6],
    paddingTop: spacing[2],
  },
  waveformOverlay: {
    // Над кнопкой 110 dp в её обёртке 160 dp
    position: 'absolute',
    bottom: 166,
    alignSelf: 'center',
    zIndex: 5,
  },

  celebration: { marginTop: spacing[2], gap: spacing[3] },
  celebrationHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  celebrationTitle: { flex: 1, color: t.c.ink },
  celebrationRow: { flexDirection: 'row', gap: spacing[2] },
  celebrationBtn: { flex: 1 },

  finishRow: {
    alignItems: 'flex-start',
    paddingVertical: spacing[1],
  },
  convoProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
  convoBarTrack: {
    flex: 1,
    maxWidth: 180,
    height: 6,
    borderRadius: 3,
    backgroundColor: t.c.border,
    overflow: 'hidden',
  },
  convoBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  hintRow: {
    paddingBottom: spacing[2],
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintPills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing[2] },
  hintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: t.c.surface,
    borderWidth: 1,
    borderColor: t.c.surfaceBorder,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  hintBtnText: {
    color: t.c.ink,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.caption,
  },
  hintBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: '#FFF6D6',
    borderWidth: 1,
    borderColor: '#F0DC92',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    maxWidth: '100%',
  },
  hintText: {
    flex: 1,
    color: t.c.ink,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.caption,
  },
}));
