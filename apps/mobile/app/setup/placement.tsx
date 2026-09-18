/**
 * Мини-проверка уровня (около минуты) для 11+ — открывается с экрана уровня в
 * родительском разделе. Адаптивная «лесенка» по четырём корзинам (A1→B2):
 * старт с A2, верный ответ — корзина выше, неверный — ниже; 6 вопросов, каждый
 * случайный из своей корзины, поэтому B2 нужно заработать на трудных вопросах
 * (условные, пассив, косвенная речь). Итог — корзина после последнего ответа.
 *
 * Результат сохраняется тем же `useSaveLevel`, что и ручной выбор, и оба экрана
 * закрываются. «×» — назад к ручному выбору.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { Icon } from '@/components/Icon';
import { InlineBanner } from '@/components/InlineBanner';
import { LessonHeader } from '@/components/LessonHeader';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { useSaveLevel } from '@/hooks/useSaveLevel';
import { UIModeProvider } from '@/hooks/useUIMode';
import { useSettings, type ChildLevel } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, spacing, tints } from '@/theme';
import { MODE_TOKENS } from '@/theme/modeTokens';
import { LEVEL_INFO } from '@/utils/levels';

interface Q { prompt: string; options: string[]; correct: number }

const TOTAL_QUESTIONS = 6;
const START_TIER = 1; // A2 — старт посередине, чтобы были доступны оба направления

// Корзины: 0=A1, 1=A2, 2=B1, 3=B2. Каждый вопрос действительно своего уровня —
// B2 значит «ответил на грамматику B2 в конце лесенки».
const POOL_EN: Q[][] = [
  [ // A1 — to-be, articles, basic present
    { prompt: 'I ___ a student.', options: ['am', 'is', 'are'], correct: 0 },
    { prompt: 'She ___ my sister.', options: ['are', 'is', 'am'], correct: 1 },
    { prompt: 'They ___ from Baku.', options: ['is', 'am', 'are'], correct: 2 },
    { prompt: 'This is ___ apple.', options: ['an', 'a', 'the'], correct: 0 },
    { prompt: 'We ___ football on Sundays.', options: ['plays', 'play', 'playing'], correct: 1 },
  ],
  [ // A2 — 3rd person -s, past simple, comparatives, some/any
    { prompt: 'She ___ to school every day.', options: ['go', 'goes', 'going'], correct: 1 },
    { prompt: 'Yesterday I ___ to the cinema.', options: ['go', 'gone', 'went'], correct: 2 },
    { prompt: 'My brother is ___ than me.', options: ['taller', 'tall', 'the tallest'], correct: 0 },
    { prompt: "There isn't ___ milk in the fridge.", options: ['some', 'any', 'no'], correct: 1 },
    { prompt: '___ your friend like pizza?', options: ['Do', 'Is', 'Does'], correct: 2 },
  ],
  [ // B1 — present perfect, 1st conditional, modals, gerunds, since/for
    { prompt: 'I have already ___ my homework.', options: ['finished', 'finish', 'finishing'], correct: 0 },
    { prompt: 'If it rains, we ___ stay home.', options: ['would', 'will', 'are'], correct: 1 },
    { prompt: 'He suggested ___ earlier.', options: ['to leave', 'left', 'leaving'], correct: 2 },
    { prompt: 'You ___ smoke in a hospital.', options: ["mustn't", "don't have to", "couldn't"], correct: 0 },
    { prompt: "I've lived here ___ 2019.", options: ['for', 'since', 'from'], correct: 1 },
  ],
  [ // B2 — unreal conditionals, passive, reported speech, wish, future perfect
    { prompt: 'If I ___ you, I would take the job.', options: ['am', 'were', 'be'], correct: 1 },
    { prompt: 'The bridge ___ by 1900.', options: ['had been built', 'was building', 'has built'], correct: 0 },
    { prompt: 'She said she ___ the film before.', options: ['has seen', 'saw', 'had seen'], correct: 2 },
    { prompt: 'I wish I ___ speak French.', options: ['can', 'could', 'will'], correct: 1 },
    { prompt: 'By next year, I ___ here for a decade.', options: ['will have been working', 'will work', 'am working'], correct: 0 },
  ],
];

const POOL_RU: Q[][] = [
  [ // A1
    { prompt: 'Выбери приветствие:', options: ['Привет', 'Стол', 'Бежать'], correct: 0 },
    { prompt: 'Это ___ дом.', options: ['моя', 'мой', 'моё'], correct: 1 },
    { prompt: 'У меня ___ кошка.', options: ['есть', 'быть', 'нет'], correct: 0 },
    { prompt: '___ зовут Анна.', options: ['Она', 'Ей', 'Её'], correct: 2 },
  ],
  [ // A2
    { prompt: 'Она ___ в школу каждый день.', options: ['идти', 'идёт', 'пошёл'], correct: 1 },
    { prompt: 'Вчера я ___ в кино.', options: ['ходил', 'хожу', 'пойду'], correct: 0 },
    { prompt: 'У меня нет ___.', options: ['время', 'времени', 'времена'], correct: 1 },
    { prompt: 'Мой брат ___ меня.', options: ['старший', 'старый', 'старше'], correct: 2 },
  ],
  [ // B1
    { prompt: 'Если будет дождь, мы ___ дома.', options: ['останемся', 'остаться', 'остались бы'], correct: 0 },
    { prompt: 'Он сказал, что ___ завтра.', options: ['пришёл', 'придёт', 'приходит'], correct: 1 },
    { prompt: 'Она попросила его ___ окно.', options: ['закрыл', 'закрывает', 'закрыть'], correct: 2 },
    { prompt: 'Он предложил ___ раньше.', options: ['уйти', 'уходя', 'ушёл'], correct: 0 },
  ],
  [ // B2
    { prompt: 'Если бы я знал, я ___ тебе.', options: ['помогу', 'помог бы', 'помогал'], correct: 1 },
    { prompt: 'Книга ___ известным писателем.', options: ['написана', 'написала', 'писала'], correct: 0 },
    { prompt: '___ дождь, мы пошли гулять.', options: ['Из-за', 'Хотя', 'Несмотря на'], correct: 2 },
    { prompt: 'Он говорит по-русски ___, чем я.', options: ['свободнее', 'свободный', 'самый свободный'], correct: 0 },
  ],
];

const LEVEL_BY_TIER: ChildLevel[] = ['beginner', 'elementary', 'pre_intermediate', 'intermediate'];

function pickQuestion(pool: Q[][], tier: number, used: Set<Q>): Q {
  const fresh = pool[tier]!.filter((q) => !used.has(q));
  const source = fresh.length > 0 ? fresh : pool[tier]!;
  return source[Math.floor(Math.random() * source.length)]!;
}

export default function PlacementScreen() {
  const router = useRouter();
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const isAz = useSettings((s) => s.parentUILanguage) === 'az';
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const { save, saving, failed } = useSaveLevel();

  const pool = (learningLanguages[0] ?? 'en') === 'ru' ? POOL_RU : POOL_EN;

  const usedRef = useRef<Set<Q>>(new Set());
  const [qNumber, setQNumber] = useState(1); // с единицы
  const [tier, setTier] = useState(START_TIER);
  const [q, setQ] = useState<Q>(() => {
    const first = pickQuestion(pool, START_TIER, usedRef.current);
    usedRef.current.add(first);
    return first;
  });
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const result = LEVEL_BY_TIER[tier] ?? 'beginner';
  const info = LEVEL_INFO[result];

  const handlePick = (i: number) => {
    if (picked !== null) return;
    Haptics.selectionAsync().catch(() => {});
    setPicked(i);
    const correct = i === q.correct;
    // Лесенка: вверх за верный, вниз за неверный (в пределах корзин).
    const nextTier = Math.max(0, Math.min(pool.length - 1, tier + (correct ? 1 : -1)));
    setTimeout(() => {
      setTier(nextTier);
      if (qNumber >= TOTAL_QUESTIONS) {
        setDone(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        const next = pickQuestion(pool, nextTier, usedRef.current);
        usedRef.current.add(next);
        setQ(next);
        setQNumber((n) => n + 1);
        setPicked(null);
      }
    }, 600);
  };

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Закрыть и проверку, и экран уровня — назад в родительский раздел.
    if (await save(result)) router.dismiss(2);
  };

  const padX = MODE_TOKENS.teen.density.padX;

  return (
    // Проверку проходит подросток или взрослый — «взрослый» режим.
    <UIModeProvider force="teen">
      <PaperBackground>
        <LessonHeader
          title={isAz ? 'Səviyyə yoxlaması' : 'Проверка уровня'}
          icon="clipboard-list"
          step={done ? TOTAL_QUESTIONS : qNumber}
          total={TOTAL_QUESTIONS}
          onClose={() => router.back()}
        />

        {done ? (
          <ScrollView contentContainerStyle={[styles.result, { paddingHorizontal: padX, paddingBottom: insets.bottom + spacing[6] }]}>
            <Animated.View entering={FadeIn.duration(400)} style={styles.resultInner}>
              <HBPet size={112} mood="happy" />
              <Text variant="caption" tone="secondary">{isAz ? 'Səviyyə' : 'Уровень'}</Text>
              <View style={[styles.resultCode, { backgroundColor: accent.bottom }]}>
                <Text style={[styles.resultCodeText, { color: accent.text }]}>{info.code}</Text>
              </View>
              <Text variant="title" align="center">{isAz ? info.az : info.ru}</Text>
              <Text variant="body" tone="secondary" align="center">{isAz ? info.descAz : info.descRu}</Text>
            </Animated.View>

            {failed ? (
              <InlineBanner
                tone="danger"
                icon="wifi-off"
                style={styles.banner}
                text={isAz
                  ? 'Yadda saxlamaq alınmadı. İnterneti yoxlayıb yenidən cəhd edin.'
                  : 'Не получилось сохранить. Проверьте интернет и попробуйте ещё раз.'}
              />
            ) : null}

            <View style={styles.resultCta}>
              <HBButton
                full
                icon="check"
                label={saving
                  ? isAz ? 'Dərslər yenilənir…' : 'Перестраиваю уроки…'
                  : isAz ? 'Bu səviyyəni saxla' : 'Сохранить этот уровень'}
                loading={saving}
                disabled={saving}
                onPress={handleSave}
              />
              <HBButton
                full
                variant="ghost"
                label={isAz ? 'Özüm seçəcəyəm' : 'Выбрать самому'}
                disabled={saving}
                onPress={() => router.back()}
              />
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={[styles.quiz, { paddingHorizontal: padX, paddingBottom: insets.bottom + spacing[6] }]}>
            <Text variant="caption" tone="secondary" align="center">
              {isAz ? 'Boşluğa uyğun variantı seçin' : 'Выберите, что подходит в пропуск'}
            </Text>

            <Animated.View key={qNumber} entering={FadeInUp.duration(300)}>
              <HBCard style={styles.qCard}>
                <Text style={styles.qPrompt}>{q.prompt}</Text>
              </HBCard>
            </Animated.View>

            <View style={styles.options}>
              {q.options.map((opt, i) => {
                const revealed = picked !== null;
                const isCorrect = revealed && i === q.correct;
                const isWrong = revealed && picked === i && i !== q.correct;
                return (
                  <Pressable
                    key={`${qNumber}-${i}`}
                    onPress={() => handlePick(i)}
                    disabled={revealed}
                    accessibilityRole="button"
                    style={[
                      styles.option,
                      isCorrect && { backgroundColor: tints.sage, borderColor: colors.accentDeep },
                      isWrong && { backgroundColor: tints.berry, borderColor: colors.berry },
                    ]}
                  >
                    <Text style={styles.optionText}>{opt}</Text>
                    {isCorrect ? <Icon name="check" size={20} color={colors.accentDeep} strokeWidth={3} /> : null}
                    {isWrong ? <Icon name="x" size={20} color={colors.berry} strokeWidth={3} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}
      </PaperBackground>
    </UIModeProvider>
  );
}

const styles = StyleSheet.create({
  quiz: { paddingTop: spacing[4], gap: spacing[4] },
  qCard: { paddingVertical: spacing[8], paddingHorizontal: spacing[5], alignItems: 'center' },
  qPrompt: { fontFamily: fontFamily.display, fontSize: fontSize['2xl'], color: colors.ink, textAlign: 'center', lineHeight: 34 },
  options: { gap: spacing[3] },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    minHeight: 56,
    paddingHorizontal: spacing[5],
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  optionText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.lg, color: colors.ink },

  result: { flexGrow: 1, paddingTop: spacing[6], gap: spacing[4] },
  resultInner: { alignItems: 'center', gap: spacing[2] },
  resultCode: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginVertical: spacing[1] },
  resultCodeText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize['2xl'] },
  banner: { marginTop: spacing[2] },
  resultCta: { gap: spacing[2], marginTop: spacing[4] },
});
