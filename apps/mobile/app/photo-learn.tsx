/**
 * Photo Learn — child takes a photo of their surroundings, GPT-4o Vision
 * returns 3-5 vocabulary words in the target language.
 *
 * Flow: tap camera → take photo → upload → flashcards of words.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { readAsBase64 } from '@/utils/recording';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBBackButton } from '@/components/HBBackButton';
import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { postPhotoLearn, type PhotoLearnResponse } from '@/services/api';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing, tints } from '@/theme';
import { useCompanionName } from '@/utils/companion';

const CARD_PALETTE: { bg: string; text: string }[] = [
  { bg: tints.primary, text: colors.primary },
  { bg: tints.sage, text: colors.accent },
  { bg: tints.butter, text: '#B8930A' },
  { bg: colors.englishLight, text: colors.english }, // sky (was off-palette violet)
  { bg: tints.berry, text: colors.berryDeep },
];

export default function PhotoLearnScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const storedHue = useSettings((s) => s.petHue);
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const childLevel = useSettings((s) => s.childLevel) ?? 'beginner';
  const authToken = useSettings((s) => s.authToken);
  const isAz = lang === 'az';
  const bot = useCompanionName();

  const targetLang = (learningLanguages[0] ?? 'en') as 'en' | 'ru';
  const apiLevel = childLevel;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PhotoLearnResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pickFromCamera() {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError(isAz ? 'Kamera icazəsi gərək' : 'Нужно разрешение на камеру');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: false,
      exif: false,
    });
    if (r.canceled || !r.assets?.[0]) return;
    await handlePhoto(r.assets[0].uri);
  }

  async function pickFromLibrary() {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: false,
      exif: false,
    });
    if (r.canceled || !r.assets?.[0]) return;
    await handlePhoto(r.assets[0].uri);
  }

  async function handlePhoto(uri: string) {
    if (!authToken) {
      setError(isAz ? 'Daxil olun' : 'Войдите чтобы пользоваться');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setImageUri(uri);
    setResult(null);
    setLoading(true);
    try {
      const { base64 } = await readAsBase64(uri, 'image/jpeg');
      const res = await postPhotoLearn(base64, targetLang, isAz ? 'az' : 'ru', apiLevel, authToken);
      setResult(res);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setError(
        e instanceof Error && e.message.toLowerCase().includes('network')
          ? (isAz ? 'İnternet yoxdur' : 'Нет интернета')
          : (isAz ? `${bot} şəkili anlamadı` : `${bot} не понял фото`),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setImageUri(null);
    setResult(null);
    setError(null);
  }

  return (
    <PaperBackground>
      {/* Top bar */}
      <View style={styles.topBar}>
        <HBBackButton inline />
        <Text style={styles.topTitle}>{isAz ? '📸 Şəkil dərsi' : '📸 Фото-урок'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Idle: empty hero + CTAs */}
        {!imageUri && !loading && !result && (
          <Animated.View entering={FadeInDown.duration(500)} style={styles.hero}>
            <View style={styles.petHalo}>
              <HBPet size={88} hue={storedHue} mood="curious" />
            </View>
            <Text style={styles.heroTitle}>
              {isAz ? 'Bobo-ya dünyanı göstər!' : 'Покажи Бобо свой мир!'}
            </Text>
            <Text style={styles.heroSub}>
              {isAz
                ? 'Şəkil çək — Bobo sənə yeni sözlər deyəcək'
                : 'Сделай фото — Бобо назовёт что на нём по-английски'}
            </Text>

            <View style={styles.ctas}>
              <HBButton
                full
                variant="primary"
                label={isAz ? '📷 Şəkil çək' : '📷 Сфотографировать'}
                onPress={pickFromCamera}
              />
              <Pressable onPress={pickFromLibrary} style={styles.libraryBtn}>
                <Text style={styles.libraryBtnText}>
                  {isAz ? '🖼️ Albomdan seç' : '🖼️ Выбрать из галереи'}
                </Text>
              </Pressable>
            </View>

            {/* Examples */}
            <View style={styles.examples}>
              <Text style={styles.examplesTitle}>
                {isAz ? 'Nə çəkə bilərsən?' : 'Что можно сфотографировать?'}
              </Text>
              <View style={styles.exRow}>
                {['🍎', '🐱', '🚗', '🌳', '📚', '🪑'].map((e, i) => (
                  <View key={i} style={[styles.exChip, { backgroundColor: CARD_PALETTE[i % CARD_PALETTE.length]!.bg }]}>
                    <Text style={styles.exEmoji}>{e}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {/* Photo + loading / result */}
        {imageUri && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.resultWrap}>
            <View style={styles.previewWrap}>
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
              {loading && (
                <View style={styles.previewOverlay}>
                  <ActivityIndicator color={colors.card} size="large" />
                  <Text style={styles.overlayText}>
                    {isAz ? 'Bobo baxır...' : 'Бобо смотрит...'}
                  </Text>
                </View>
              )}
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {result && (
              <>
                <Animated.View entering={FadeInUp.duration(400)} style={styles.summaryBox}>
                  <HBPet size={48} hue={storedHue} mood="happy" />
                  <Text style={styles.summaryText}>{result.summary}</Text>
                </Animated.View>

                <View style={styles.cards}>
                  {result.items.map((item, i) => {
                    const p = CARD_PALETTE[i % CARD_PALETTE.length]!;
                    return (
                      <Animated.View
                        key={`${item.word}-${i}`}
                        entering={FadeInUp.duration(400).delay(100 + i * 100)}
                      >
                        <HBCard depth="md" ringColor={p.text} style={styles.wordCard}>
                          <View style={[styles.wordEmoji, { backgroundColor: p.bg }]}>
                            <Text style={{ fontSize: 36 }}>{item.emoji}</Text>
                          </View>
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text style={[styles.wordMain, { color: p.text }]}>{item.word}</Text>
                            <Text style={styles.wordTranslation}>{item.translation}</Text>
                            <View style={[styles.exampleBox, { backgroundColor: p.bg }]}>
                              <Text style={[styles.exampleText, { color: p.text }]}>
                                «{item.example}»
                              </Text>
                            </View>
                          </View>
                        </HBCard>
                      </Animated.View>
                    );
                  })}
                </View>
              </>
            )}

            <View style={styles.bottomCTAs}>
              <HBButton
                full
                variant="primary"
                label={isAz ? '📷 Başqa şəkil' : '📷 Ещё фото'}
                onPress={() => { reset(); pickFromCamera(); }}
                disabled={loading}
              />
              <Pressable onPress={reset} style={styles.libraryBtn}>
                <Text style={styles.libraryBtnText}>
                  {isAz ? 'Geri' : 'Назад'}
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

  hero: {
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
  },
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
  },
  heroSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },

  ctas: { width: '100%', gap: spacing[2], marginTop: spacing[3] },
  libraryBtn: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  libraryBtnText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },

  examples: { marginTop: spacing[4], alignItems: 'center', gap: spacing[2] },
  examplesTitle: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  exRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing[2] },
  exChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exEmoji: { fontSize: 22 },

  // Result
  resultWrap: { gap: spacing[4] },
  previewWrap: {
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    aspectRatio: 4 / 3,
    backgroundColor: colors.bgDeep,
    ...shadow.md,
  },
  preview: { width: '100%', height: '100%' },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },
  overlayText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.card,
  },

  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
  },
  summaryText: {
    flex: 1,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.ink,
    lineHeight: 19,
  },

  cards: { gap: spacing[3] },
  wordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  wordEmoji: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  wordMain: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    letterSpacing: -0.3,
  },
  wordTranslation: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
  exampleBox: {
    marginTop: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  exampleText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
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

  bottomCTAs: { gap: spacing[2], marginTop: spacing[3] },
});
