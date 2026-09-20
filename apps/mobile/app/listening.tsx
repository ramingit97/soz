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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBIconBox } from '@/components/HBIconBox';
import { HBPet } from '@/components/HBPet';
import { Icon } from '@/components/Icon';
import { InlineBanner } from '@/components/InlineBanner';
import { PaperBackground } from '@/components/PaperBackground';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useTheme } from '@/hooks/useTheme';
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
import { localDateISO, localOffsetMinutes } from '@soz/shared-types';
import { useCompanionName } from '@/utils/companion';
import { fontFamily, fontSize, radius, spacing } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';

interface LocalStory {
  id: string;
  title: string;
  text: string;
  questions: ListeningQuestionDTO[];
  phrases: ListeningPhraseDTO[];
  audioUri: string;
}

async function cacheAudio(id: string, base64: string, mimeType: string): Promise<string> {
  // На вебе файловой системы нет — writeAsStringAsync бросал, и история не
  // открывалась вовсе (веб-превью для владельца). Плеер понимает data-URI.
  if (Platform.OS === 'web') return `data:${mimeType};base64,${base64}`;
  const ext = mimeType.includes('mp3') || mimeType.includes('mpeg') ? 'mp3' : mimeType.includes('wav') ? 'wav' : 'm4a';
  const uri = `${FileSystem.cacheDirectory ?? ''}listening-${id}.${ext}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

export default function ListeningScreen() {
  const router = useRouter();
  // `fromLesson=1&day=N` — экран открыт как шаг урока дня (день-история в плане):
  // после вопросов он засчитывает урок. Без параметров — библиотека историй.
  const params = useLocalSearchParams<{ lang?: string; day?: string; fromLesson?: string }>();
  const lessonDay = Number(params.day);
  const fromLesson = params.fromLesson === '1' && Number.isFinite(lessonDay) && lessonDay > 0;
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const bot = useCompanionName();
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const childId = useSettings((s) => s.childId);
  const authToken = useSettings((s) => s.authToken);
  const childLevel = useSettings((s) => s.childLevel);
  const isAz = lang === 'az';
  const { c, mode: uiMode, t, accent } = useTheme();
  const styles = stylesByMode[uiMode];
  const learnLang: 'en' | 'ru' =
    params.lang === 'en' || params.lang === 'ru' ? params.lang : learningLanguages[0] ?? 'en';

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
      // Генерация иногда падает на разборе ответа модели (502) — один повтор
      // незаметно для ребёнка лучше, чем «не получилось». Лимит (429) не повторяем.
      const s = await generateListeningStory(childId, learnLang, authToken, childLevel ?? undefined).catch((e: unknown) => {
        if (e instanceof Error && e.message.startsWith('429')) throw e;
        return generateListeningStory(childId, learnLang, authToken, childLevel ?? undefined);
      });
      const audioUri = await cacheAudio(s.id, s.audioBase64, s.audioMimeType);
      const local: LocalStory = {
        id: s.id, title: s.title, text: s.text, questions: s.questions, phrases: s.phrases ?? [], audioUri,
      };
      await AsyncStorage.setItem(`listening:${s.id}`, JSON.stringify(local)).catch(() => {});
      await AsyncStorage.setItem(`listening-autogen:${childId}`, new Date().toISOString().slice(0, 10)).catch(() => {});
      await openStory(local);
      refreshLibrary();
    } catch (e) {
      // Автоматическая история при первом входе раньше падала молча — экран
      // оставался пустым, и было непонятно, что произошло. Сообщение показываем
      // всегда; вибрация — только на нажатие кнопки.
      const msg = e instanceof Error ? e.message : '';
      setNotice(
        msg.startsWith('429') || msg.includes('daily_limit')
          ? (isAz ? 'Bu gün üçün limit doldu — köhnə hekayələri dinlə' : 'На сегодня лимит историй — переслушай старые')
          : (isAz ? 'Hekayəni hazırlamaq alınmadı. İnterneti yoxla və yenidən cəhd et.' : 'Не получилось подготовить историю. Проверь интернет и попробуй ещё раз.'),
      );
      if (!opts?.silent) {
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
    if (fromLesson) {
      // Урок дня открыт повторно (вышли и вернулись) — берём сегодняшнюю историю,
      // а не генерируем новую: иначе упёрлись бы в дневной лимит и день-историю
      // стало бы невозможно завершить.
      const today = localDateISO(localOffsetMinutes());
      getListeningStories(childId, authToken)
        .then((list) => {
          const todays = list.find(
            (st) => st.language === learnLang && localDateISO(localOffsetMinutes(), new Date(st.createdAt)) === today,
          );
          if (todays) handleOpenFromLibrary(todays.id);
          else handleGenerate({ silent: true });
        })
        .catch(() => handleGenerate({ silent: true }));
      return;
    }
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
        const info = local.audioUri.startsWith('data:')
          ? { exists: true }
          : await FileSystem.getInfoAsync(local.audioUri);
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
  const allAnswered = !!current && current.questions.every((_, qi) => answers[qi] !== undefined);

  return (
    <PaperBackground>
      <ScreenHeader
        title={isAz ? 'Dinlə' : 'Слушай'}
        right={
          <Pressable
            onPress={() => router.push('/phrases' as any)}
            hitSlop={8}
            accessibilityRole="button"
            style={styles.reviewLink}
          >
            <Icon name="repeat" size={14} color={accent.ink} strokeWidth={2.5} />
            <Text style={[styles.reviewLinkText, { color: accent.ink }]}>{isAz ? 'İfadələrim' : 'Мои фразы'}</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: t.density.padX, gap: t.density.gap }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.intro}>
          <HBPet size={t.mascot.inline} mood={playing ? 'happy' : busy ? 'thinking' : 'curious'} talking={playing} />
          <Text variant="body" tone="secondary" style={styles.introText}>
            {busy && !current
              ? (isAz ? `${bot} hekayə hazırlayır…` : `${bot} готовит историю…`)
              : (isAz ? `${bot} sənin üçün hekayə danışır` : `${bot} расскажет историю для тебя`)}
          </Text>
        </Animated.View>

        {needsAccount ? (
          <HBCard style={{ gap: spacing[3] }}>
            <Text variant="body" tone="secondary">
              {isAz
                ? `${bot} hekayələri profil qurulandan sonra danışır.`
                : `${bot} рассказывает истории после настройки профиля.`}
            </Text>
            <HBButton
              full
              label={isAz ? 'Profili qur' : 'Настроить профиль'}
              onPress={() => router.push('/setup/profile-type' as never)}
            />
          </HBCard>
        ) : (
          <>
            {current && (
              <Animated.View key={current.id} entering={FadeIn.duration(350)} style={{ gap: t.density.gap }}>
                <HBCard style={styles.storyCard}>
                  <Text variant="headline">{current.title}</Text>
                  <View style={styles.controls}>
                    <Pressable
                      onPress={() => play(current.audioUri)}
                      accessibilityRole="button"
                      style={[styles.playBtn, { backgroundColor: accent.soft }]}
                    >
                      <Icon name={playing ? 'volume-2' : 'play'} size={20} color={accent.ink} strokeWidth={2.5} />
                      <Text style={[styles.playBtnLabel, { color: accent.ink }]}>{isAz ? 'Bir də' : 'Ещё раз'}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setShowText((v) => !v)}
                      accessibilityRole="button"
                      style={styles.textToggle}
                    >
                      <Icon name="book-open" size={18} color={c.inkSoft} />
                      <Text style={styles.textToggleLabel}>
                        {showText ? (isAz ? 'Gizlət' : 'Скрыть текст') : (isAz ? 'Mətn' : 'Текст')}
                      </Text>
                    </Pressable>
                  </View>
                  {showText && <Text variant="body" style={styles.storyText}>{current.text}</Text>}
                </HBCard>

                {/* Вопросы на понимание */}
                {current.questions.length > 0 && (
                  <View style={styles.qBlock}>
                    <Text variant="label" tone="secondary">{isAz ? 'Suallar' : 'Вопросы'}</Text>
                    {current.questions.map((q, qi) => {
                      const picked = answers[qi];
                      return (
                        <HBCard key={qi} style={styles.qCard}>
                          <Text variant="bodyBold">{q.q}</Text>
                          {q.options.map((opt, oi) => {
                            const revealed = picked !== undefined;
                            const isCorrect = oi === q.correct;
                            const isPicked = picked === oi;
                            const state = revealed && isCorrect ? 'right' : revealed && isPicked ? 'wrong' : 'idle';
                            return (
                              <Pressable
                                key={oi}
                                disabled={revealed}
                                accessibilityRole="button"
                                accessibilityState={{ selected: isPicked, disabled: revealed }}
                                onPress={() => {
                                  Haptics.selectionAsync().catch(() => {});
                                  setAnswers((p) => ({ ...p, [qi]: oi }));
                                }}
                                style={[styles.opt, state === 'right' && styles.optRight, state === 'wrong' && styles.optWrong]}
                              >
                                <Text variant="body" style={styles.optText}>{opt}</Text>
                                {state === 'right' ? (
                                  <Icon name="circle-check" size={18} color={c.accentDeep} strokeWidth={2.5} />
                                ) : state === 'wrong' ? (
                                  <Icon name="x" size={18} color={c.berryDeep} strokeWidth={2.5} />
                                ) : null}
                              </Pressable>
                            );
                          })}
                        </HBCard>
                      );
                    })}
                  </View>
                )}

                {/* Полезные фразы → в повторение */}
                {current.phrases.length > 0 && (
                  <View style={styles.qBlock}>
                    <Text variant="label" tone="secondary">{isAz ? 'Faydalı ifadələr' : 'Полезные фразы'}</Text>
                    {current.phrases.map((ph, i) => (
                      <HBCard key={i} style={styles.phraseCard}>
                        <Text variant="bodyBold" style={styles.phraseText}>{ph.text}</Text>
                        <Text variant="caption" tone="secondary" style={styles.phraseTr}>{ph.translation}</Text>
                      </HBCard>
                    ))}
                    <HBButton
                      full
                      variant="soft"
                      icon={savedNote ? 'check' : 'bookmark-plus'}
                      label={savedNote ? (isAz ? 'Təkrara əlavə olundu' : 'Добавлено в повторение') : (isAz ? 'Təkrara əlavə et' : 'В повторение')}
                      onPress={handleSavePhrases}
                      disabled={savedNote}
                    />
                  </View>
                )}
              </Animated.View>
            )}

            {notice ? (
              <InlineBanner
                tone="danger"
                text={notice}
                onClose={() => setNotice(null)}
                closeLabel={isAz ? 'Bağla' : 'Закрыть'}
              />
            ) : null}

            {fromLesson && current ? (
              <View style={{ gap: spacing[2] }}>
                <HBButton
                  full
                  icon="circle-check"
                  label={isAz ? 'Dərsi bitir' : 'Завершить урок'}
                  disabled={!allAnswered}
                  onPress={() => {
                    stopPlayback();
                    router.replace(`/lesson/complete?lang=${learnLang}&day=${lessonDay}` as never);
                  }}
                />
                {!allAnswered ? (
                  <Text variant="caption" tone="secondary" align="center">
                    {isAz ? 'Əvvəlcə suallara cavab ver' : 'Сначала ответь на вопросы'}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* Новая история */}
            {(!fromLesson || (!current && !busy)) && (
              <Animated.View entering={FadeInUp.duration(400).delay(100)}>
                <HBButton
                  full
                  icon="sparkles"
                  loading={busy}
                  label={busy ? (isAz ? 'Hazırlanır…' : 'Готовлю…') : (isAz ? 'Yeni hekayə' : 'Новая история')}
                  onPress={() => handleGenerate()}
                  disabled={busy}
                />
              </Animated.View>
            )}
            {fromLesson && busy && !current ? (
              <View style={styles.preparing}>
                <ActivityIndicator color={accent.ink} />
              </View>
            ) : null}

            {/* Библиотека */}
            {!fromLesson && library.length > 0 && (
              <View style={styles.qBlock}>
                <Text variant="label" tone="secondary">{isAz ? 'Hekayələrim' : 'Мои истории'}</Text>
                {library.map((st) => (
                  <Pressable
                    key={st.id}
                    onPress={() => handleOpenFromLibrary(st.id)}
                    disabled={busy}
                    accessibilityRole="button"
                  >
                    <HBCard style={styles.libItem}>
                      <HBIconBox icon="headphones" tint={accent.soft} iconColor={accent.ink} size={36} />
                      <Text variant="bodyBold" style={styles.libItemTitle} numberOfLines={1}>{st.title}</Text>
                      <Icon name="chevron-right" size={20} color={c.inkSoft} />
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

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  scroll: { paddingTop: spacing[2], paddingBottom: spacing[10] },

  intro: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  introText: { flex: 1 },
  reviewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: t.c.surface,
    borderWidth: 1,
    borderColor: t.c.surfaceBorder,
  },
  reviewLinkText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.xs },

  storyCard: { gap: spacing[3] },
  controls: { flexDirection: 'row', gap: spacing[2] },
  playBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
  },
  playBtnLabel: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.base },
  textToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: t.c.surface,
    borderWidth: 1,
    borderColor: t.c.surfaceBorder,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
  },
  textToggleLabel: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: t.c.inkSoft },
  storyText: { lineHeight: 26 },

  qBlock: { gap: spacing[2] },
  qCard: { gap: spacing[2] },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: t.c.surfaceBorder,
    backgroundColor: t.c.surface,
  },
  optRight: { backgroundColor: '#E3F7EF', borderColor: '#B9E3D5' },
  optWrong: { backgroundColor: '#FDE3E8', borderColor: '#F5C2CC' },
  optText: { flex: 1 },

  phraseCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[3] },
  phraseText: { flex: 1 },
  phraseTr: { textAlign: 'right', flexShrink: 1 },

  preparing: { alignItems: 'center', paddingVertical: spacing[2] },

  libItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  libItemTitle: { flex: 1 },
}));
