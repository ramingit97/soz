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

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { Icon } from '@/components/Icon';
import { LessonHeader } from '@/components/LessonHeader';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { useTheme } from '@/hooks/useTheme';
import { getDuePhrases, gradePhrase, type SrsCard } from '@/services/srs';
import { useSettings } from '@/store/settings';
import { fontFamily, fontSize, spacing } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';

export default function PhrasesScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childId = useSettings((s) => s.childId);
  const petHue = useSettings((s) => s.petHue);
  const isAz = lang === 'az';
  const { c: palette, mode: uiMode, t, accent } = useTheme();
  const styles = stylesByMode[uiMode];

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

  const title = isAz ? 'İfadələrim' : 'Мои фразы';

  if (!childId || done) {
    return (
      <PaperBackground edges={['top', 'bottom']}>
        <Animated.View entering={FadeIn.duration(300)} style={[styles.center, { paddingHorizontal: t.density.padX }]}>
          <HBPet size={t.mascot.hero} hue={petHue} mood={reviewed > 0 ? 'happy' : 'curious'} />
          <Text variant="title" align="center">
            {!childId
              ? isAz ? 'Hesab lazımdır' : 'Нужен аккаунт'
              : reviewed > 0
                ? isAz ? 'Əla iş!' : 'Отлично!'
                : isAz ? 'Hələ ifadə yoxdur' : 'Пока нет фраз'}
          </Text>
          <Text variant="body" tone="secondary" align="center" style={styles.note}>
            {reviewed > 0
              ? isAz ? `${reviewed} ifadə təkrarladın` : `Повторено фраз: ${reviewed}`
              : isAz ? 'Hekayə dinlə və ifadələri təkrara əlavə et.' : 'Послушай историю и добавь фразы в повторение.'}
          </Text>
          <HBButton icon="headphones" label={isAz ? 'Hekayələrə' : 'К историям'} onPress={() => router.replace('/listening' as any)} />
          <HBButton variant="ghost" label={isAz ? 'Geri' : 'Назад'} onPress={() => router.back()} />
        </Animated.View>
      </PaperBackground>
    );
  }

  return (
    <PaperBackground>
      <LessonHeader title={title} icon="repeat" step={idx + 1} total={queue.length} onClose={() => router.back()} />
      <View style={[styles.body, { paddingHorizontal: t.density.padX }]}>
        {card ? (
          <Animated.View key={card.id} entering={FadeInUp.duration(300)} style={styles.cardWrap}>
            <Pressable
              onPress={() => setRevealed(true)}
              accessibilityRole="button"
              accessibilityHint={isAz ? 'Tərcüməni göstər' : 'Показать перевод'}
            >
              <HBCard style={styles.card}>
                <Text style={styles.front}>{card.text}</Text>
                {revealed ? (
                  <Text style={[styles.back, { color: accent.ink }]}>{card.translation}</Text>
                ) : (
                  <View style={styles.hint}>
                    <Icon name="book-open" size={16} color={palette.inkSoft} />
                    <Text variant="caption" tone="secondary">{isAz ? 'Tərcüməni göstər' : 'Показать перевод'}</Text>
                  </View>
                )}
              </HBCard>
            </Pressable>

            {revealed ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.gradeRow}>
                <HBButton variant="soft" icon="refresh-cw" label={isAz ? 'Yenidən' : 'Ещё раз'} onPress={() => grade(false)} style={styles.flex} />
                <HBButton icon="check" label={isAz ? 'Bilirəm' : 'Знаю'} onPress={() => grade(true)} style={styles.flex} />
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : null}
      </View>
    </PaperBackground>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  body: { flex: 1, paddingBottom: spacing[8] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  note: { maxWidth: 300 },
  cardWrap: { flex: 1, justifyContent: 'center', gap: spacing[5] },
  card: { alignItems: 'center', justifyContent: 'center', gap: spacing[4], minHeight: 200, paddingVertical: spacing[8] },
  front: { fontFamily: fontFamily.display, fontSize: fontSize['2xl'], color: t.c.ink, textAlign: 'center' },
  back: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.lg, textAlign: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  gradeRow: { flexDirection: 'row', gap: spacing[3] },
  flex: { flex: 1 },
}));
