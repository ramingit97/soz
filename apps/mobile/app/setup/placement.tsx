/**
 * Mini placement (≈60-90s) for older learners (14-16). ADAPTIVE staircase over
 * tiered pools (A1→B2): start at A2, a correct answer steps up a tier, a wrong
 * one steps down — 6 questions, each drawn randomly from its tier's pool, so
 * the test differs run to run and B2 must be EARNED on genuinely hard items
 * (conditionals/passive/reported speech), never on "I am a student".
 * The final level = the tier the staircase settles on after the last answer.
 * "Not sure" falls back to the self-report level screen.
 *
 * Reached from the age screen when the 14-16 range is chosen; sets childLevel
 * and continues to the goal step.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { useSettings, type ChildLevel } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';
import { StepIndicator } from '@/components/StepIndicator';

interface Q { prompt: string; options: string[]; correct: number }

const TOTAL_QUESTIONS = 6;
const START_TIER = 1; // A2 — mid start so both directions stay reachable

// Tier pools: index 0=A1, 1=A2, 2=B1, 3=B2. Each question is genuinely OF its
// tier — reaching B2 means answering B2 grammar at the end of the staircase.
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
const LEVEL_META: Record<ChildLevel, { code: string; ru: string; az: string; color: string }> = {
  beginner: { code: 'A1', ru: 'Начинающий', az: 'Yeni başlayan', color: colors.accent },
  elementary: { code: 'A2', ru: 'Элементарный', az: 'Elementar', color: colors.butterDeep ?? colors.butter },
  pre_intermediate: { code: 'B1', ru: 'Средний', az: 'Orta', color: colors.english },
  intermediate: { code: 'B2', ru: 'Уверенный', az: 'Sərbəst', color: colors.primary },
};

function pickQuestion(pool: Q[][], tier: number, used: Set<Q>): Q {
  const fresh = pool[tier]!.filter((q) => !used.has(q));
  const source = fresh.length > 0 ? fresh : pool[tier]!;
  return source[Math.floor(Math.random() * source.length)]!;
}

export default function PlacementScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const childAge = useSettings((s) => s.childAge) ?? 14;
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const petHue = useSettings((s) => s.petHue);
  const setChildProfile = useSettings((s) => s.setChildProfile);
  const isAz = lang === 'az';

  const targetRu = (learningLanguages[0] ?? 'en') === 'ru';
  const pool = targetRu ? POOL_RU : POOL_EN;

  const usedRef = useRef<Set<Q>>(new Set());
  const [qNumber, setQNumber] = useState(1); // 1-based
  const [tier, setTier] = useState(START_TIER);
  const [q, setQ] = useState<Q>(() => {
    const first = pickQuestion(pool, START_TIER, usedRef.current);
    usedRef.current.add(first);
    return first;
  });
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const result = LEVEL_BY_TIER[tier] ?? 'beginner';
  const meta = LEVEL_META[result];

  const handlePick = (i: number) => {
    if (picked !== null) return;
    Haptics.selectionAsync().catch(() => {});
    setPicked(i);
    const correct = i === q.correct;
    // Staircase: up on correct, down on wrong (clamped) — the tier after the
    // LAST answer is the placement result.
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
    }, 450);
  };

  const finish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setChildProfile(childName, childAge, result);
    router.push('/setup/goals' as any);
  };

  return (
    <PaperBackground>
      <View style={styles.container}>
        <StepIndicator current={5} total={7} />

        {done ? (
          <Animated.View entering={FadeIn.duration(400)} style={styles.resultWrap}>
            <HBPet size={120} hue={petHue} mood="happy" />
            <Text style={styles.resultLabel}>{isAz ? 'Sənin səviyyən' : 'Твой уровень'}</Text>
            <View style={[styles.codeBadge, { backgroundColor: meta.color }]}>
              <Text style={styles.codeBadgeText}>{meta.code}</Text>
            </View>
            <Text style={styles.resultName}>{isAz ? meta.az : meta.ru}</Text>
            <Text style={styles.resultSub}>
              {isAz ? 'Dərsləri buna görə kökləyəcəyik' : 'Настроим уроки под него'}
            </Text>
            <View style={styles.resultCta}>
              <HBButton full variant="primary" label={isAz ? 'Davam et' : 'Продолжить'} onPress={finish} />
            </View>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
              <Text style={styles.title}>{isAz ? 'Kiçik yoxlama' : 'Быстрая проверка'}</Text>
              <Text style={styles.sub}>
                {isAz
                  ? `${TOTAL_QUESTIONS} sual — suallar cavablarına uyğunlaşır`
                  : `${TOTAL_QUESTIONS} вопросов — они подстраиваются под твои ответы`}
              </Text>
              <View style={styles.progressRow}>
                {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
                  <View key={i} style={[styles.pdot, i < qNumber && styles.pdotActive]} />
                ))}
              </View>
            </Animated.View>

            <Animated.View key={qNumber} entering={FadeInUp.duration(350)} style={[styles.qCard, shadow.md]}>
              <Text style={styles.qPrompt}>{q.prompt}</Text>
            </Animated.View>

            <View style={styles.options}>
              {q.options.map((opt, i) => {
                const revealed = picked !== null;
                const isCorrect = i === q.correct;
                const isPicked = picked === i;
                const bg = revealed && isCorrect
                  ? '#E3F7EF'
                  : revealed && isPicked
                    ? '#FDE3E8'
                    : colors.card;
                const border = revealed && isCorrect
                  ? colors.accent
                  : revealed && isPicked
                    ? colors.berry
                    : 'transparent';
                return (
                  <Pressable
                    key={i}
                    onPress={() => handlePick(i)}
                    disabled={revealed}
                    style={[styles.option, shadow.sm, { backgroundColor: bg, borderColor: border }]}
                  >
                    <Text style={styles.optionText}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flex: 1 }} />
            {/* Level screen is now always the parent (level-first flow) — back, don't stack. */}
            <Pressable onPress={() => router.back()} style={styles.skip} hitSlop={8}>
              <Text style={styles.skipText}>{isAz ? 'Əmin deyiləm — özüm seçim' : 'Не уверен — выберу сам'}</Text>
            </Pressable>
          </>
        )}
      </View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing[6], paddingTop: 50, paddingBottom: spacing[6] },

  header: { alignItems: 'center', gap: spacing[2], marginTop: spacing[4] },
  title: { fontFamily: fontFamily.display, fontSize: fontSize['3xl'], color: colors.ink, letterSpacing: -0.5 },
  sub: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.inkSoft, textAlign: 'center' },
  progressRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  pdot: { width: 28, height: 6, borderRadius: 3, backgroundColor: colors.border },
  pdotActive: { backgroundColor: colors.primary },

  qCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[5],
    alignItems: 'center',
    marginTop: spacing[6],
  },
  qPrompt: { fontFamily: fontFamily.display, fontSize: fontSize['2xl'], color: colors.ink, textAlign: 'center', lineHeight: 34 },

  options: { gap: spacing[3], marginTop: spacing[5] },
  option: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    borderRadius: radius.xl,
    alignItems: 'center',
    borderWidth: 2,
  },
  optionText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.lg, color: colors.ink },

  skip: { alignSelf: 'center', paddingVertical: spacing[3] },
  skipText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.inkSoft },

  resultWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  resultLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing[4],
  },
  codeBadge: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', ...shadow.md },
  codeBadgeText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize['3xl'], color: colors.white },
  resultName: { fontFamily: fontFamily.display, fontSize: fontSize['2xl'], color: colors.ink },
  resultSub: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.inkSoft, textAlign: 'center' },
  resultCta: { alignSelf: 'stretch', marginTop: spacing[6] },
});
