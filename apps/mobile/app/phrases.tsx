/**
 * Phrases review — spaced-repetition flashcards for phrases the learner saved
 * from listening stories. Reads the on-device SRS (services/srs.ts): shows due
 * cards, reveal translation, grade "know"/"again" → Leitner re-schedule.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { HBBackButton } from '@/components/HBBackButton';
import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { getDuePhrases, gradePhrase, type SrsCard } from '@/services/srs';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

export default function PhrasesScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childId = useSettings((s) => s.childId);
  const petHue = useSettings((s) => s.petHue);
  const isAz = lang === 'az';

  const [queue, setQueue] = useState<SrsCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  useEffect(() => {
    if (!childId) { setLoaded(true); return; }
    getDuePhrases(childId)
      .then((c) => { setQueue(c); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [childId]);

  const card = queue[idx];
  const done = loaded && !card;

  const grade = async (known: boolean) => {
    if (!childId || !card) return;
    Haptics.selectionAsync().catch(() => {});
    await gradePhrase(childId, card.id, known);
    setReviewed((n) => n + 1);
    setRevealed(false);
    setIdx((i) => i + 1);
  };

  return (
    <PaperBackground>
      <View style={styles.container}>
        <HBBackButton />

        <View style={styles.header}>
          <Text style={styles.title}>{isAz ? 'Təkrar' : 'Повторение'}</Text>
          {!done && card && <Text style={styles.counter}>{idx + 1} / {queue.length}</Text>}
        </View>

        {!childId ? (
          <View style={styles.center}>
            <Text style={styles.empty}>{isAz ? 'Hesab lazımdır.' : 'Нужен аккаунт.'}</Text>
          </View>
        ) : done ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.center}>
            <HBPet size={120} hue={petHue} mood="happy" />
            <Text style={styles.emptyTitle}>
              {reviewed > 0 ? (isAz ? 'Əla iş!' : 'Отлично!') : (isAz ? 'Hələ ifadə yoxdur' : 'Пока нет фраз')}
            </Text>
            <Text style={styles.empty}>
              {reviewed > 0
                ? (isAz ? `${reviewed} ifadə təkrarladın 🎉` : `Повторено фраз: ${reviewed} 🎉`)
                : (isAz ? 'Hekayə dinlə və ifadələri təkrara əlavə et.' : 'Послушай историю и добавь фразы в повторение.')}
            </Text>
            <View style={styles.doneCta}>
              <HBButton full variant="primary" label={isAz ? '🎧 Hekayələrə' : '🎧 К историям'} onPress={() => router.replace('/listening' as any)} />
            </View>
          </Animated.View>
        ) : card ? (
          <Animated.View key={card.id} entering={FadeInUp.duration(300)} style={styles.cardWrap}>
            <Pressable onPress={() => setRevealed(true)} style={[styles.card, shadow.md]}>
              <Text style={styles.cardFront}>{card.text}</Text>
              {revealed ? (
                <Text style={styles.cardBack}>{card.translation}</Text>
              ) : (
                <Text style={styles.tapHint}>{isAz ? 'Tərcüməni göstər' : 'Показать перевод'}</Text>
              )}
            </Pressable>

            {revealed && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.gradeRow}>
                <Pressable onPress={() => grade(false)} style={[styles.gradeBtn, styles.again]}>
                  <Text style={styles.gradeText}>{isAz ? 'Yenidən' : 'Ещё раз'}</Text>
                </Pressable>
                <Pressable onPress={() => grade(true)} style={[styles.gradeBtn, styles.know]}>
                  <Text style={[styles.gradeText, { color: colors.white }]}>{isAz ? 'Bilirəm' : 'Знаю'}</Text>
                </Pressable>
              </Animated.View>
            )}
          </Animated.View>
        ) : null}
      </View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing[6], paddingTop: 50, paddingBottom: spacing[8] },

  header: { alignItems: 'center', gap: spacing[1], marginTop: spacing[4], marginBottom: spacing[6] },
  title: { fontFamily: fontFamily.display, fontSize: fontSize['3xl'], color: colors.ink, letterSpacing: -0.5 },
  counter: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.inkSoft },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  emptyTitle: { fontFamily: fontFamily.display, fontSize: fontSize['2xl'], color: colors.ink, marginTop: spacing[3] },
  empty: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.base, color: colors.inkSoft, textAlign: 'center', lineHeight: 24, maxWidth: 300 },
  doneCta: { alignSelf: 'stretch', marginTop: spacing[6] },

  cardWrap: { flex: 1, justifyContent: 'center', gap: spacing[5] },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[6],
    alignItems: 'center',
    gap: spacing[4],
    minHeight: 200,
    justifyContent: 'center',
  },
  cardFront: { fontFamily: fontFamily.display, fontSize: fontSize['2xl'], color: colors.ink, textAlign: 'center' },
  cardBack: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.lg, color: colors.primaryDeep, textAlign: 'center' },
  tapHint: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.inkSoft },

  gradeRow: { flexDirection: 'row', gap: spacing[3] },
  gradeBtn: { flex: 1, paddingVertical: spacing[4], borderRadius: radius.xl, alignItems: 'center', ...shadow.sm },
  again: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.border },
  know: { backgroundColor: colors.accent },
  gradeText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.base, color: colors.ink },
});
