/**
 * Songs / Karaoke — generates a short 4-line rhyme from today's vocab,
 * sings it via OpenAI TTS, and highlights lyrics line-by-line in sync.
 */

import {
  createAudioPlayer,
  setAudioModeAsync,
} from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBBackButton } from '@/components/HBBackButton';
import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import { postSong, type SongResponse } from '@/services/api';
import { useSettings } from '@/store/settings';
import { useCompanionName } from '@/utils/companion';
import { colors, fontFamily, fontSize, radius, shadow, spacing, tints } from '@/theme';

export default function SongsScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const bot = useCompanionName();
  const storedHue = useSettings((s) => s.petHue);
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const currentDay = useSettings((s) => s.currentDay);
  const authToken = useSettings((s) => s.authToken);
  const isAz = lang === 'az';

  const targetLang = (learningLanguages[0] ?? 'en') as 'en' | 'ru';
  const lesson = getLesson(targetLang, currentDay);
  const vocab = lesson?.vocabulary ?? [];
  const theme = lesson?.theme ?? '';

  const [loading, setLoading] = useState(false);
  const [song, setSong] = useState<SongResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeLine, setActiveLine] = useState(-1);
  const [playing, setPlaying] = useState(false);

  const playerRef = useRef<AudioPlayer | null>(null);
  const lineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      // pause() before remove() — remove alone can leave the channel audible
      try { playerRef.current?.pause(); } catch { /* released */ }
      playerRef.current?.remove();
      if (lineTimerRef.current) clearTimeout(lineTimerRef.current);
    };
  }, []);

  async function generateSong() {
    if (!authToken || vocab.length < 2) {
      setError(isAz ? 'Söz yoxdur' : 'Слов недостаточно');
      return;
    }
    setError(null);
    setLoading(true);
    setSong(null);
    try {
      const res = await postSong(vocab, targetLang, theme || undefined, authToken);
      setSong(res);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setError(
        e instanceof Error && e.message.toLowerCase().includes('network')
          ? (isAz ? 'İnternet yoxdur' : 'Нет интернета')
          : (isAz ? 'Mahnı yaradılmadı' : 'Не удалось создать песню'),
      );
    } finally {
      setLoading(false);
    }
  }

  async function playSong() {
    if (!song) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      // Write base64 to file (data URIs are unreliable on iOS)
      const fileUri = `${FileSystem.cacheDirectory ?? ''}song-${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(fileUri, song.audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });

      try { playerRef.current?.pause(); } catch { /* released */ }
      playerRef.current?.remove();
      const player = createAudioPlayer({ uri: fileUri });
      playerRef.current = player;
      setPlaying(true);
      setActiveLine(0);
      player.play();

      // Rough line-by-line highlight: total duration / 4 per line.
      // We don't know the duration up-front, so guess from line count + char count.
      // 0.6s per word at speed=0.9 + 0.4s pause = decent guess.
      const lineDurations = song.lyrics.map((line) => {
        const words = line.split(/\s+/).filter(Boolean).length;
        return Math.max(1200, words * 600 + 400);
      });

      let i = 0;
      const advance = () => {
        if (i >= song.lyrics.length - 1) return;
        i += 1;
        setActiveLine(i);
        lineTimerRef.current = setTimeout(advance, lineDurations[i]!);
      };
      lineTimerRef.current = setTimeout(advance, lineDurations[0]!);

      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          sub.remove();
          setPlaying(false);
          setActiveLine(-1);
          if (lineTimerRef.current) clearTimeout(lineTimerRef.current);
        }
      });
    } catch (e) {
      console.warn('song playback failed', e);
      setPlaying(false);
      setActiveLine(-1);
    }
  }

  function stopSong() {
    playerRef.current?.pause();
    setPlaying(false);
    setActiveLine(-1);
    if (lineTimerRef.current) clearTimeout(lineTimerRef.current);
  }

  return (
    <PaperBackground variant="honey">
      {/* Top bar */}
      <View style={styles.topBar}>
        <HBBackButton inline />
        <Text style={styles.topTitle}>{isAz ? '🎵 Mahnılar' : '🎵 Песни'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.hero}>
          <View style={styles.petHalo}>
            <HBPet size={92} hue={storedHue} mood="happy" talking={playing} />
          </View>
          <Text style={styles.heroTitle}>
            {song
              ? (isAz ? `🎶 ${bot} mahnı oxuyur` : `🎶 ${bot} поёт песню`)
              : (isAz ? '🎤 Bu günün mahnısı' : '🎤 Песня дня')}
          </Text>
          <Text style={styles.heroSub}>
            {isAz
              ? `«${theme}» mövzusunda ${vocab.length} söz`
              : `${vocab.length} слов на тему «${theme}»`}
          </Text>
        </Animated.View>

        {/* Generate button (idle state) */}
        {!song && !loading && (
          <Animated.View entering={FadeInUp.duration(400).delay(100)}>
            <View style={styles.vocabPreview}>
              {vocab.slice(0, 5).map((w, i) => (
                <View key={w} style={[styles.vocabChip, i % 2 === 0 ? styles.vocabChipA : styles.vocabChipB]}>
                  <Text style={styles.vocabChipText}>{w}</Text>
                </View>
              ))}
            </View>
            <HBButton
              full
              variant="primary"
              label={isAz ? '🎶 Mahnı yarat' : '🎶 Создать песню'}
              onPress={generateSong}
            />
            <Text style={styles.tip}>
              {isAz
                ? 'Bobo 4 sətrlik mahnı bəstələyir. ~15 saniyə.'
                : 'Бобо сочинит 4 строчки. ~15 секунд.'}
            </Text>
          </Animated.View>
        )}

        {/* Loading */}
        {loading && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.loaderBox}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loaderText}>
              {isAz ? 'Bobo bəstələyir...' : 'Бобо сочиняет...'}
            </Text>
          </Animated.View>
        )}

        {/* Error */}
        {error && (
          <Animated.View entering={FadeIn.duration(300)}>
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </Animated.View>
        )}

        {/* Song lyrics + play */}
        {song && (
          <Animated.View entering={FadeInUp.duration(500)} style={styles.lyricsCard}>
            <HBCard depth="md" ringColor={colors.primary} style={styles.lyricsBox}>
              {song.lyrics.map((line, i) => (
                <Animated.View key={i} entering={FadeInUp.duration(300).delay(i * 100)}>
                  <Text
                    style={[
                      styles.lyricLine,
                      activeLine === i && styles.lyricLineActive,
                      activeLine > i && styles.lyricLineDone,
                    ]}
                  >
                    {line}
                  </Text>
                </Animated.View>
              ))}
            </HBCard>

            <View style={styles.playRow}>
              {!playing ? (
                <HBButton
                  full
                  variant="primary"
                  label={isAz ? '▶ Başla' : '▶ Играть'}
                  onPress={playSong}
                />
              ) : (
                <HBButton
                  full
                  variant="berry"
                  label={isAz ? '⏸ Dayan' : '⏸ Стоп'}
                  onPress={stopSong}
                />
              )}
              <Pressable onPress={generateSong} style={styles.regenBtn}>
                <Text style={styles.regenBtnText}>
                  {isAz ? '🔄 Yeni mahnı' : '🔄 Новая песня'}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
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
    paddingBottom: spacing[8],
    gap: spacing[4],
  },

  hero: { alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  petHalo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
    ...shadow.md,
  },
  heroTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginTop: spacing[1],
  },
  heroSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
  },

  vocabPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  vocabChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  vocabChipA: { backgroundColor: colors.primarySoft },
  vocabChipB: { backgroundColor: tints.sage },
  vocabChipText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  tip: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing[2],
  },

  loaderBox: { paddingVertical: spacing[8], gap: spacing[3], alignItems: 'center' },
  loaderText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.inkSoft,
  },

  errorBox: {
    backgroundColor: '#FFF0F0',
    borderRadius: radius.lg,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.error,
    textAlign: 'center',
  },

  lyricsCard: { gap: spacing[4] },
  lyricsBox: { gap: spacing[3] },
  lyricLine: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 30,
    opacity: 0.55,
  },
  lyricLineActive: {
    color: colors.primary,
    opacity: 1,
    fontSize: fontSize.xl,
  },
  lyricLineDone: {
    color: colors.accent,
    opacity: 0.75,
  },

  playRow: { gap: spacing[2] },
  regenBtn: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  regenBtnText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
});
