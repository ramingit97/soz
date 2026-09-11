/**
 * Listening — AI-generated, personalized stories the child listens to.
 *
 * The story is written around the child's name + interests at their level and
 * read aloud (TTS). Each story is SAVED to the child's library so it can be
 * re-listened (free on the same device via local cache). After listening: a
 * couple of comprehension questions + key phrases you can push into spaced
 * repetition. New generations are capped server-side per day (cost guard).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBBackButton } from '@/components/HBBackButton';
import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import {
  generateListeningStory,
  getListeningStories,
  getListeningStory,
  type ListeningPhraseDTO,
  type ListeningQuestionDTO,
  type ListeningStoryMeta,
} from '@/services/api';
import { savePhrases } from '@/services/srs';
import { useSettings } from '@/store/settings';
import { useCompanionName } from '@/utils/companion';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing } from '@/theme';

interface LocalStory {
  id: string;
  title: string;
  text: string;
  questions: ListeningQuestionDTO[];
  phrases: ListeningPhraseDTO[];
  audioUri: string;
}

async function cacheAudio(id: string, base64: string, mimeType: string): Promise<string> {
  const ext = mimeType.includes('mp3') || mimeType.includes('mpeg') ? 'mp3' : mimeType.includes('wav') ? 'wav' : 'm4a';
  const uri = `${FileSystem.cacheDirectory ?? ''}listening-${id}.${ext}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

export default function ListeningScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const bot = useCompanionName();
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const childId = useSettings((s) => s.childId);
  const authToken = useSettings((s) => s.authToken);
  const childLevel = useSettings((s) => s.childLevel);
  const petHue = useSettings((s) => s.petHue);
  const isAz = lang === 'az';
  const learnLang = learningLanguages[0] ?? 'en';

  const [library, setLibrary] = useState<ListeningStoryMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<LocalStory | null>(null);
  const [showText, setShowText] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);
  const busyRef = useRef(false);

  const refreshLibrary = useCallback(() => {
    if (!childId || !authToken) return;
    getListeningStories(childId, authToken).then(setLibrary).catch(() => {});
  }, [childId, authToken]);

  useEffect(() => { refreshLibrary(); }, [refreshLibrary]);

  // Fully silence the current player. pause() BEFORE remove(): remove alone can
  // leave an actively-playing channel audible → two voices at once.
  const stopPlayback = useCallback(() => {
    try { playerRef.current?.pause(); } catch { /* already released */ }
    try { playerRef.current?.remove(); } catch { /* already released */ }
    playerRef.current = null;
    setPlaying(false);
  }, []);

  useEffect(() => () => {
    try { playerRef.current?.pause(); } catch { /* already released */ }
    try { playerRef.current?.remove(); } catch { /* already released */ }
    playerRef.current = null;
  }, []);

  const play = useCallback(async (uri: string) => {
    try {
      stopPlayback();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      // Stop again after the await — a concurrent play() could have started
      // another player while we yielded (the double-voice race).
      stopPlayback();
      const player = createAudioPlayer({ uri });
      playerRef.current = player;
      setPlaying(true);
      player.play();
      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) { sub.remove(); setPlaying(false); }
      });
    } catch {
      setPlaying(false);
    }
  }, [stopPlayback]);

  const openStory = useCallback(async (s: LocalStory) => {
    setCurrent(s);
    setShowText(false);
    setAnswers({});
    setSavedNote(false);
    play(s.audioUri);
  }, [play]);

  const handleGenerate = useCallback(async (opts?: { silent?: boolean }) => {
    // busyRef: synchronous double-tap guard — `busy` state updates async, so two
    // fast taps could both pass it and generate (and PLAY) two stories at once.
    if (!childId || !authToken || busyRef.current) return;
    busyRef.current = true;
    if (!opts?.silent) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setBusy(true);
    setNotice(null);
    try {
      const s = await generateListeningStory(childId, learnLang, authToken, childLevel ?? undefined);
      const audioUri = await cacheAudio(s.id, s.audioBase64, s.audioMimeType);
      const local: LocalStory = {
        id: s.id, title: s.title, text: s.text, questions: s.questions, phrases: s.phrases ?? [], audioUri,
      };
      await AsyncStorage.setItem(`listening:${s.id}`, JSON.stringify(local)).catch(() => {});
      await AsyncStorage.setItem(`listening-autogen:${childId}`, new Date().toISOString().slice(0, 10)).catch(() => {});
      await openStory(local);
      refreshLibrary();
    } catch (e) {
      if (!opts?.silent) {
        const msg = e instanceof Error ? e.message : '';
        setNotice(
          msg.includes('daily_limit') || msg.includes('429')
            ? (isAz ? 'Bu gün üçün limit doldu — köhnə hekayələri dinlə 🎧' : 'На сегодня лимит — переслушай старые истории 🎧')
            : (isAz ? 'Alınmadı, yenidən cəhd et' : 'Не получилось, попробуй ещё раз'),
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [childId, authToken, learnLang, childLevel, isAz, openStory, refreshLibrary]);

  // Auto-story: the first visit each day starts generating immediately — the
  // child shouldn't have to find the "new story" button (founder feedback).
  // Silent failure path (cap reached / offline → just the library).
  useEffect(() => {
    if (!childId || !authToken) return;
    let cancelled = false;
    AsyncStorage.getItem(`listening-autogen:${childId}`)
      .then((last) => {
        if (cancelled) return;
        const today = new Date().toISOString().slice(0, 10);
        if (last !== today) handleGenerate({ silent: true });
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, authToken]);

  const handleOpenFromLibrary = async (id: string) => {
    if (!authToken || busy) return;
    Haptics.selectionAsync().catch(() => {});
    setBusy(true);
    setNotice(null);
    try {
      // Free re-listen: use the locally cached text + audio if both still present.
      const raw = await AsyncStorage.getItem(`listening:${id}`).catch(() => null);
      if (raw) {
        const local = JSON.parse(raw) as LocalStory;
        const info = await FileSystem.getInfoAsync(local.audioUri);
        if (info.exists) { await openStory({ ...local, phrases: local.phrases ?? [] }); return; }
      }
      // Otherwise fetch + re-cache (re-runs TTS once).
      const s = await getListeningStory(id, authToken);
      const audioUri = await cacheAudio(s.id, s.audioBase64, s.audioMimeType);
      const local: LocalStory = {
        id: s.id, title: s.title, text: s.text, questions: s.questions, phrases: s.phrases ?? [], audioUri,
      };
      await AsyncStorage.setItem(`listening:${s.id}`, JSON.stringify(local)).catch(() => {});
      await openStory(local);
    } catch {
      setNotice(isAz ? 'Alınmadı, yenidən cəhd et' : 'Не получилось, попробуй ещё раз');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const handleSavePhrases = async () => {
    if (!current || !childId || !current.phrases.length) return;
    const n = await savePhrases(childId, current.phrases, learnLang);
    setSavedNote(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    void n;
  };

  const needsAccount = !childId || !authToken;

  return (
    <PaperBackground variant="honey">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <HBBackButton />

        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <HBPet size={88} hue={petHue} mood={playing ? 'happy' : 'curious'} talking={playing} />
          <Text style={styles.title}>{isAz ? 'Dinlə' : 'Слушай'}</Text>
          <Text style={styles.sub}>
            {isAz ? `${bot} sənin üçün hekayə danışır` : `${bot} расскажет историю для тебя`}
          </Text>
          <Pressable onPress={() => router.push('/phrases' as any)} style={styles.reviewLink} hitSlop={8}>
            <Text style={styles.reviewLinkText}>{isAz ? '🔁 İfadələrim' : '🔁 Мои фразы'}</Text>
          </Pressable>
        </Animated.View>

        {needsAccount ? (
          <HBCard style={{ alignItems: 'center', gap: spacing[2] }}>
            <Text style={styles.sub}>
              {isAz ? 'Bu funksiya üçün hesab lazımdır.' : 'Для этой функции нужен аккаунт.'}
            </Text>
          </HBCard>
        ) : (
          <>
            {current && (
              <Animated.View key={current.id} entering={FadeIn.duration(350)}>
                <HBCard style={styles.storyCard} depth="md">
                  <Text style={styles.storyTitle}>{current.title}</Text>
                  <View style={styles.controls}>
                    <Pressable onPress={() => play(current.audioUri)} style={[styles.playBtn, shadow.sm]}>
                      <Text style={styles.playBtnText}>{playing ? '🔊' : '▶'}</Text>
                      <Text style={styles.playBtnLabel}>{isAz ? 'Bir də' : 'Ещё раз'}</Text>
                    </Pressable>
                    <Pressable onPress={() => setShowText((v) => !v)} style={[styles.textToggle, shadow.sm]}>
                      <Text style={styles.textToggleLabel}>
                        {showText ? (isAz ? 'Mətni gizlət' : 'Скрыть текст') : (isAz ? 'Mətni göstər' : 'Показать текст')}
                      </Text>
                    </Pressable>
                  </View>
                  {showText && <Text style={styles.storyText}>{current.text}</Text>}
                </HBCard>

                {/* Comprehension questions */}
                {current.questions.length > 0 && (
                  <View style={styles.qBlock}>
                    <Text style={styles.qHeader}>{isAz ? 'Sual' : 'Вопросы'}</Text>
                    {current.questions.map((q, qi) => {
                      const picked = answers[qi];
                      return (
                        <HBCard key={qi} style={styles.qCard} depth="sm">
                          <Text style={styles.qText}>{q.q}</Text>
                          {q.options.map((opt, oi) => {
                            const revealed = picked !== undefined;
                            const isCorrect = oi === q.correct;
                            const isPicked = picked === oi;
                            const bg = revealed && isCorrect ? '#E3F7EF' : revealed && isPicked ? '#FDE3E8' : colors.white;
                            return (
                              <Pressable
                                key={oi}
                                disabled={revealed}
                                onPress={() => {
                                  Haptics.selectionAsync().catch(() => {});
                                  setAnswers((p) => ({ ...p, [qi]: oi }));
                                }}
                                style={[styles.opt, { backgroundColor: bg }]}
                              >
                                <Text style={styles.optText}>{opt}</Text>
                              </Pressable>
                            );
                          })}
                        </HBCard>
                      );
                    })}
                  </View>
                )}

                {/* Key phrases → spaced repetition */}
                {current.phrases.length > 0 && (
                  <View style={styles.qBlock}>
                    <Text style={styles.qHeader}>{isAz ? 'Faydalı ifadələr' : 'Полезные фразы'}</Text>
                    {current.phrases.map((p, i) => (
                      <HBCard key={i} style={styles.phraseCard} depth="sm">
                        <Text style={styles.phraseText}>{p.text}</Text>
                        <Text style={styles.phraseTr}>{p.translation}</Text>
                      </HBCard>
                    ))}
                    <View style={{ marginTop: spacing[2] }}>
                      <HBButton
                        full
                        variant="butter"
                        label={savedNote ? (isAz ? '✓ Təkrara əlavə olundu' : '✓ Добавлено в повторение') : (isAz ? '📌 Təkrara əlavə et' : '📌 В повторение')}
                        onPress={handleSavePhrases}
                        disabled={savedNote}
                      />
                    </View>
                  </View>
                )}
              </Animated.View>
            )}

            {notice && (
              <Animated.View entering={FadeIn.duration(250)}>
                <Text style={styles.notice}>{notice}</Text>
              </Animated.View>
            )}

            {/* New story */}
            <Animated.View entering={FadeInUp.duration(450).delay(120)} style={{ marginTop: spacing[4] }}>
              <HBButton
                full
                variant="primary"
                label={busy ? (isAz ? 'Hazırlanır…' : 'Готовлю…') : (isAz ? '✨ Yeni hekayə' : '✨ Новая история')}
                onPress={() => handleGenerate()}
                disabled={busy}
              />
              {busy && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing[3] }} />}
            </Animated.View>

            {/* Library */}
            {library.length > 0 && (
              <View style={{ marginTop: spacing[6] }}>
                <Text style={styles.libHeader}>{isAz ? 'Hekayələrim' : 'Мои истории'}</Text>
                {library.map((s) => (
                  <Pressable key={s.id} onPress={() => handleOpenFromLibrary(s.id)} disabled={busy}>
                    <HBCard style={styles.libItem} depth="sm">
                      <Text style={{ fontSize: 20 }}>🎧</Text>
                      <Text style={styles.libItemTitle} numberOfLines={1}>{s.title}</Text>
                      <Text style={styles.libItemArrow}>›</Text>
                    </HBCard>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[6], paddingTop: 56, paddingBottom: spacing[10] },

  header: { alignItems: 'center', gap: spacing[2], marginBottom: spacing[5], marginTop: spacing[4] },
  title: { fontFamily: fontFamily.display, fontSize: fontSize['3xl'], color: colors.ink, letterSpacing: -0.5, marginTop: spacing[2] },
  sub: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.inkSoft, textAlign: 'center' },
  reviewLink: {
    marginTop: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.card,
    ...shadow.sm,
  },
  reviewLinkText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.primaryDeep },

  storyCard: { gap: spacing[3] },
  storyTitle: { fontFamily: fontFamily.display, fontSize: fontSize.xl, color: colors.ink, textAlign: 'center' },
  controls: { flexDirection: 'row', gap: spacing[2] },
  playBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
  },
  playBtnText: { fontSize: fontSize.lg },
  playBtnLabel: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.base, color: colors.primaryDeep },
  textToggle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
  },
  textToggleLabel: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.inkSoft },
  storyText: { fontFamily: fontFamily.body, fontSize: fontSize.base, color: colors.ink, lineHeight: 26 },

  qBlock: { marginTop: spacing[4], gap: spacing[3] },
  qHeader: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.caption,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  qCard: { gap: spacing[2] },
  qText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.base, color: colors.ink },
  opt: { borderRadius: radius.md, paddingVertical: spacing[3], paddingHorizontal: spacing[4] },
  optText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.base, color: colors.ink },

  phraseCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[3] },
  phraseText: { flex: 1, fontFamily: fontFamily.bodyBlack, fontSize: fontSize.base, color: colors.ink },
  phraseTr: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.caption, color: colors.inkSoft, textAlign: 'right', flexShrink: 1 },

  notice: {
    marginTop: spacing[4],
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
  },

  libHeader: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.caption,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[3],
  },
  libItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[2] },
  libItemTitle: { flex: 1, fontFamily: fontFamily.bodyBold, fontSize: fontSize.base, color: colors.ink },
  libItemArrow: { fontFamily: fontFamily.bodyBlack, fontSize: scaleFont(22), color: colors.inkSoft },
});
