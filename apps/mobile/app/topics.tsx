/**
 * Topic picker → live conversation (the learna.ai-style "pick a theme, then
 * talk about it" feature). Strongest for 13+/older learners. Each topic carries
 * an English instruction passed as the talk `scenario`; the AI engine already
 * accepts it and answers in the learning language. Custom topics are supported.
 *
 * Slice 1: topic → conversation. (Later: pre-teach phrases + curated YouTube clip
 * + "what did you take away" recall loop.)
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBIconBox } from '@/components/HBIconBox';
import { HBPet } from '@/components/HBPet';
import { Icon, type IconName } from '@/components/Icon';
import { PaperBackground } from '@/components/PaperBackground';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useTheme } from '@/hooks/useTheme';
import { useSettings } from '@/store/settings';
import { fontFamily, fontSize, radius, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';
import { makeModeStyles } from '@/theme/modeTokens';

export interface TopicGoal {
  ru: string; // learner-facing label (RU UI)
  az: string; // learner-facing label (AZ UI)
  en: string; // detection criterion sent to the AI (never shown to the learner)
}

interface Topic {
  key: string;
  icon: IconName;
  ru: string;
  az: string;
  scenario: string; // English instruction for the AI (empty = free chat)
  goals?: TopicGoal[]; // 3 micro-goals → checklist in the talk screen
}

const TOPICS: Topic[] = [
  { key: 'school', icon: 'school', ru: 'Школа', az: 'Məktəb', scenario: 'Have a friendly conversation about school life, classes, teachers and friends. Ask questions and gently correct mistakes.', goals: [
    { ru: 'Назови любимый предмет', az: 'Sevimli fənnini de', en: 'The learner named a school subject they like or dislike' },
    { ru: 'Расскажи об учителе или друге', az: 'Müəllim və ya dost haqqında danış', en: 'The learner described a teacher or a classmate/friend' },
    { ru: 'Задай свой вопрос', az: 'Öz sualını ver', en: 'The learner asked the partner a question about school' },
  ] },
  { key: 'gaming', icon: 'gamepad-2', ru: 'Игры', az: 'Oyunlar', scenario: 'Chat about video games — favorite games, characters and why they are fun. React naturally and help with mistakes.', goals: [
    { ru: 'Назови любимую игру', az: 'Sevimli oyununu de', en: 'The learner named a favorite video game' },
    { ru: 'Объясни, почему она нравится', az: 'Niyə xoşladığını izah et', en: 'The learner explained why they like a game (gave a reason)' },
    { ru: 'Задай свой вопрос', az: 'Öz sualını ver', en: 'The learner asked the partner a question about games' },
  ] },
  { key: 'movies', icon: 'clapperboard', ru: 'Кино и сериалы', az: 'Film və seriallar', scenario: 'Talk about movies and series — recent favorites, actors and plots. Ask follow-up questions and gently correct mistakes.', goals: [
    { ru: 'Назови любимый фильм или сериал', az: 'Sevimli filmini de', en: 'The learner named a favorite movie or series' },
    { ru: 'Расскажи, о чём он', az: 'Nədən bəhs etdiyini danış', en: 'The learner described a plot or a character of a movie/series' },
    { ru: 'Попроси совет, что посмотреть', az: 'Nə izləməyi məsləhət istə', en: 'The learner asked for a movie or series recommendation' },
  ] },
  { key: 'music', icon: 'music', ru: 'Музыка', az: 'Musiqi', scenario: 'Chat about music — favorite artists, songs and concerts. React naturally and gently correct mistakes.', goals: [
    { ru: 'Назови любимого исполнителя', az: 'Sevimli ifaçını de', en: 'The learner named a favorite artist, band or song' },
    { ru: 'Расскажи, когда слушаешь музыку', az: 'Musiqini nə vaxt dinlədiyini danış', en: 'The learner said when or where they listen to music' },
    { ru: 'Задай свой вопрос', az: 'Öz sualını ver', en: 'The learner asked the partner a question about music' },
  ] },
  { key: 'sports', icon: 'volleyball', ru: 'Спорт', az: 'İdman', scenario: 'Talk about sports — favorite teams, players and playing sports. Keep it friendly and help with mistakes.', goals: [
    { ru: 'Назови любимый спорт или команду', az: 'Sevimli idmanını və ya komandanı de', en: 'The learner named a favorite sport, team or athlete' },
    { ru: 'Расскажи, как часто занимаешься', az: 'Nə qədər tez-tez məşq etdiyini danış', en: 'The learner said how often they play or train (or that they do not)' },
    { ru: 'Задай свой вопрос', az: 'Öz sualını ver', en: 'The learner asked the partner a question about sports' },
  ] },
  { key: 'travel', icon: 'plane', ru: 'Путешествия', az: 'Səyahət', scenario: 'Chat about travel — places to visit, airports and hotels. Ask questions and gently help with mistakes.', goals: [
    { ru: 'Назови страну мечты', az: 'Arzu ölkəni de', en: 'The learner named a country or city they want to visit (or have visited)' },
    { ru: 'Объясни, почему туда хочешь', az: 'Niyə ora istədiyini izah et', en: 'The learner explained why they want to go there (gave a reason)' },
    { ru: 'Задай свой вопрос', az: 'Öz sualını ver', en: 'The learner asked the partner a question about travel' },
  ] },
  { key: 'food', icon: 'utensils', ru: 'Еда', az: 'Yemək', scenario: 'Talk about food — favorite dishes, cooking and restaurants. React naturally and gently correct mistakes.', goals: [
    { ru: 'Назови любимое блюдо', az: 'Sevimli yeməyini de', en: 'The learner named a favorite dish or food' },
    { ru: 'Опиши его вкус', az: 'Dadını təsvir et', en: 'The learner described the taste or ingredients of a food' },
    { ru: 'Задай свой вопрос', az: 'Öz sualını ver', en: 'The learner asked the partner a question about food' },
  ] },
  { key: 'exam', icon: 'graduation-cap', ru: 'Подготовка к экзамену', az: 'İmtahana hazırlıq', scenario: 'Act as a friendly examiner. Ask common speaking-exam questions about everyday topics, one at a time, and give short encouraging feedback.', goals: [
    { ru: 'Ответь полным предложением', az: 'Tam cümlə ilə cavab ver', en: 'The learner answered a question with a complete sentence of 6+ words' },
    { ru: 'Назови причину («потому что…»)', az: 'Səbəb göstər («çünki…»)', en: 'The learner gave a reason for an opinion (e.g. used "because" or explained why)' },
    { ru: 'Задай встречный вопрос', az: 'Qarşı sual ver', en: 'The learner asked the examiner a question back' },
  ] },
];

export default function TopicsScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const isAz = lang === 'az';
  const bot = useCompanionName();
  const { c, mode: uiMode, t, accent } = useTheme();
  const styles = stylesByMode[uiMode];
  const learnLang = learningLanguages[0] ?? 'en';

  const [custom, setCustom] = useState('');

  const goScenario = (scenario: string, goals?: TopicGoal[]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Slice-2 coaching loop: pre-teach a few phrases, converse, then active recall.
    const coached = scenario
      ? `${scenario} First, teach 3 short useful phrases for this topic and show them clearly. Then have the conversation using them. Near the end, ask which words or phrases they want to remember, and recap those 2-3.`
      : '';
    const s = coached ? `&scenario=${encodeURIComponent(coached)}` : '';
    const g = goals?.length ? `&goals=${encodeURIComponent(JSON.stringify(goals))}` : '';
    // replace, а не push: «Говорить» уже под этим экраном, темы не копятся в стеке.
    // Без `day=1` — разговор идёт в контексте текущего дня.
    router.replace(`/talk?lang=${learnLang}${s}${g}` as any);
  };

  const goCustom = () => {
    const t = custom.trim();
    if (t.length < 2) return;
    goScenario(
      `Have a friendly, natural conversation about "${t}". Stay on this topic, ask follow-up questions, and gently help with mistakes.`,
    );
  };

  const canSend = custom.trim().length >= 2;

  return (
    <PaperBackground>
      <ScreenHeader title={isAz ? 'Nədən danışaq?' : 'О чём поговорим?'} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: t.density.padX, gap: t.density.gap }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.intro}>
          <HBPet size={t.mascot.inline} mood="curious" />
          <Text variant="body" tone="secondary" style={styles.introText}>
            {isAz ? `Mövzu seç — ${bot} ilə canlı söhbət` : `Выбери тему — живой разговор с ${bot}`}
          </Text>
        </Animated.View>

        {/* Своя тема */}
        <Animated.View entering={FadeInUp.duration(400).delay(80)} style={styles.customRow}>
          <TextInput
            value={custom}
            onChangeText={setCustom}
            placeholder={isAz ? 'Öz mövzun...' : 'Своя тема...'}
            placeholderTextColor={c.textMuted}
            style={styles.customInput}
            maxLength={60}
            returnKeyType="go"
            onSubmitEditing={goCustom}
            accessibilityLabel={isAz ? 'Öz mövzun' : 'Своя тема'}
          />
          <Pressable
            onPress={goCustom}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={isAz ? 'Başla' : 'Начать'}
            style={[styles.customBtn, { backgroundColor: accent.bottom }, !canSend && styles.customBtnOff]}
          >
            <Icon name="arrow-right" size={24} color={accent.text} strokeWidth={2.5} />
          </Pressable>
        </Animated.View>

        {/* Темы */}
        <View style={styles.grid}>
          {TOPICS.map((topic, i) => (
            <Animated.View key={topic.key} entering={FadeInUp.duration(400).delay(120 + i * 40)} style={styles.gridItem}>
              <Pressable
                onPress={() => goScenario(topic.scenario, topic.goals)}
                accessibilityRole="button"
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <HBCard style={styles.topicCard}>
                  <HBIconBox icon={topic.icon} tint={accent.soft} iconColor={accent.ink} size={40} />
                  <Text variant="bodyBold" numberOfLines={2} style={styles.topicText}>
                    {isAz ? topic.az : topic.ru}
                  </Text>
                </HBCard>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        {/* Свободный разговор */}
        <Animated.View entering={FadeInUp.duration(400).delay(460)}>
          <HBButton
            full
            variant="soft"
            icon="message-circle"
            label={isAz ? 'Sərbəst söhbət' : 'Свободный разговор'}
            onPress={() => goScenario('')}
          />
        </Animated.View>
      </ScrollView>
    </PaperBackground>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  scroll: { paddingTop: spacing[2], paddingBottom: spacing[10] },

  intro: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  introText: { flex: 1 },

  customRow: { flexDirection: 'row', gap: spacing[2] },
  customInput: {
    flex: 1,
    minHeight: 52,
    backgroundColor: t.c.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: t.c.ink,
    borderWidth: 1.5,
    borderColor: t.c.surfaceBorder,
  },
  customBtn: {
    width: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customBtnOff: { opacity: 0.45 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing[3] },
  gridItem: { width: '48.5%' },
  pressed: { transform: [{ scale: 0.97 }] },
  topicCard: { gap: spacing[2], minHeight: 104 },
  topicText: { color: t.c.ink },
}));
