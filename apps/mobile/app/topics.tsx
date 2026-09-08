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

import { HBBackButton } from '@/components/HBBackButton';
import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

export interface TopicGoal {
  ru: string; // learner-facing label (RU UI)
  az: string; // learner-facing label (AZ UI)
  en: string; // detection criterion sent to the AI (never shown to the learner)
}

interface Topic {
  key: string;
  emoji: string;
  ru: string;
  az: string;
  scenario: string; // English instruction for the AI (empty = free chat)
  goals?: TopicGoal[]; // 3 micro-goals → checklist in the talk screen
}

const TOPICS: Topic[] = [
  { key: 'school', emoji: '🏫', ru: 'Школа', az: 'Məktəb', scenario: 'Have a friendly conversation about school life, classes, teachers and friends. Ask questions and gently correct mistakes.', goals: [
    { ru: 'Назови любимый предмет', az: 'Sevimli fənnini de', en: 'The learner named a school subject they like or dislike' },
    { ru: 'Расскажи об учителе или друге', az: 'Müəllim və ya dost haqqında danış', en: 'The learner described a teacher or a classmate/friend' },
    { ru: 'Задай свой вопрос', az: 'Öz sualını ver', en: 'The learner asked the partner a question about school' },
  ] },
  { key: 'gaming', emoji: '🎮', ru: 'Игры', az: 'Oyunlar', scenario: 'Chat about video games — favorite games, characters and why they are fun. React naturally and help with mistakes.', goals: [
    { ru: 'Назови любимую игру', az: 'Sevimli oyununu de', en: 'The learner named a favorite video game' },
    { ru: 'Объясни, почему она нравится', az: 'Niyə xoşladığını izah et', en: 'The learner explained why they like a game (gave a reason)' },
    { ru: 'Задай свой вопрос', az: 'Öz sualını ver', en: 'The learner asked the partner a question about games' },
  ] },
  { key: 'movies', emoji: '🎬', ru: 'Кино и сериалы', az: 'Film və seriallar', scenario: 'Talk about movies and series — recent favorites, actors and plots. Ask follow-up questions and gently correct mistakes.', goals: [
    { ru: 'Назови любимый фильм или сериал', az: 'Sevimli filmini de', en: 'The learner named a favorite movie or series' },
    { ru: 'Расскажи, о чём он', az: 'Nədən bəhs etdiyini danış', en: 'The learner described a plot or a character of a movie/series' },
    { ru: 'Попроси совет, что посмотреть', az: 'Nə izləməyi məsləhət istə', en: 'The learner asked for a movie or series recommendation' },
  ] },
  { key: 'music', emoji: '🎵', ru: 'Музыка', az: 'Musiqi', scenario: 'Chat about music — favorite artists, songs and concerts. React naturally and gently correct mistakes.', goals: [
    { ru: 'Назови любимого исполнителя', az: 'Sevimli ifaçını de', en: 'The learner named a favorite artist, band or song' },
    { ru: 'Расскажи, когда слушаешь музыку', az: 'Musiqini nə vaxt dinlədiyini danış', en: 'The learner said when or where they listen to music' },
    { ru: 'Задай свой вопрос', az: 'Öz sualını ver', en: 'The learner asked the partner a question about music' },
  ] },
  { key: 'sports', emoji: '⚽', ru: 'Спорт', az: 'İdman', scenario: 'Talk about sports — favorite teams, players and playing sports. Keep it friendly and help with mistakes.', goals: [
    { ru: 'Назови любимый спорт или команду', az: 'Sevimli idmanını və ya komandanı de', en: 'The learner named a favorite sport, team or athlete' },
    { ru: 'Расскажи, как часто занимаешься', az: 'Nə qədər tez-tez məşq etdiyini danış', en: 'The learner said how often they play or train (or that they do not)' },
    { ru: 'Задай свой вопрос', az: 'Öz sualını ver', en: 'The learner asked the partner a question about sports' },
  ] },
  { key: 'travel', emoji: '🌍', ru: 'Путешествия', az: 'Səyahət', scenario: 'Chat about travel — places to visit, airports and hotels. Ask questions and gently help with mistakes.', goals: [
    { ru: 'Назови страну мечты', az: 'Arzu ölkəni de', en: 'The learner named a country or city they want to visit (or have visited)' },
    { ru: 'Объясни, почему туда хочешь', az: 'Niyə ora istədiyini izah et', en: 'The learner explained why they want to go there (gave a reason)' },
    { ru: 'Задай свой вопрос', az: 'Öz sualını ver', en: 'The learner asked the partner a question about travel' },
  ] },
  { key: 'food', emoji: '🍔', ru: 'Еда', az: 'Yemək', scenario: 'Talk about food — favorite dishes, cooking and restaurants. React naturally and gently correct mistakes.', goals: [
    { ru: 'Назови любимое блюдо', az: 'Sevimli yeməyini de', en: 'The learner named a favorite dish or food' },
    { ru: 'Опиши его вкус', az: 'Dadını təsvir et', en: 'The learner described the taste or ingredients of a food' },
    { ru: 'Задай свой вопрос', az: 'Öz sualını ver', en: 'The learner asked the partner a question about food' },
  ] },
  { key: 'exam', emoji: '🎓', ru: 'Подготовка к экзамену', az: 'İmtahana hazırlıq', scenario: 'Act as a friendly examiner. Ask common speaking-exam questions about everyday topics, one at a time, and give short encouraging feedback.', goals: [
    { ru: 'Ответь полным предложением', az: 'Tam cümlə ilə cavab ver', en: 'The learner answered a question with a complete sentence of 6+ words' },
    { ru: 'Назови причину («потому что…»)', az: 'Səbəb göstər («çünki…»)', en: 'The learner gave a reason for an opinion (e.g. used "because" or explained why)' },
    { ru: 'Задай встречный вопрос', az: 'Qarşı sual ver', en: 'The learner asked the examiner a question back' },
  ] },
];

export default function TopicsScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const petHue = useSettings((s) => s.petHue);
  const isAz = lang === 'az';
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
    router.push(`/talk?lang=${learnLang}&day=1${s}${g}` as any);
  };

  const goCustom = () => {
    const t = custom.trim();
    if (t.length < 2) return;
    goScenario(
      `Have a friendly, natural conversation about "${t}". Stay on this topic, ask follow-up questions, and gently help with mistakes.`,
    );
  };

  return (
    <PaperBackground>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <HBBackButton />

        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <HBPet size={84} hue={petHue} mood="curious" />
          <Text style={styles.title}>{isAz ? 'Nədən danışaq?' : 'О чём поговорим?'}</Text>
          <Text style={styles.sub}>{isAz ? 'Mövzu seç — Хани ilə canlı söhbət' : 'Выбери тему — живой разговор с Хани'}</Text>
        </Animated.View>

        {/* Custom topic */}
        <Animated.View entering={FadeInUp.duration(450).delay(100)} style={styles.customRow}>
          <TextInput
            value={custom}
            onChangeText={setCustom}
            placeholder={isAz ? 'Öz mövzun...' : 'Своя тема...'}
            placeholderTextColor={colors.inkSoft}
            style={styles.customInput}
            maxLength={60}
            returnKeyType="go"
            onSubmitEditing={goCustom}
          />
          <Pressable onPress={goCustom} disabled={custom.trim().length < 2} style={[styles.customBtn, custom.trim().length < 2 && { opacity: 0.5 }]}>
            <Text style={styles.customBtnText}>→</Text>
          </Pressable>
        </Animated.View>

        {/* Topic grid */}
        <View style={styles.grid}>
          {TOPICS.map((t, i) => (
            <Animated.View key={t.key} entering={FadeInUp.duration(420).delay(150 + i * 50)} style={styles.gridItem}>
              <Pressable onPress={() => goScenario(t.scenario, t.goals)} style={({ pressed }) => [styles.topicCard, shadow.sm, pressed && { transform: [{ scale: 0.97 }] }]}>
                <Text style={styles.topicEmoji}>{t.emoji}</Text>
                <Text style={styles.topicText}>{isAz ? t.az : t.ru}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        {/* Free chat */}
        <Animated.View entering={FadeInUp.duration(450).delay(560)} style={{ marginTop: spacing[4] }}>
          <HBButton
            full
            variant="soft"
            label={isAz ? '💬 Sərbəst söhbət' : '💬 Свободный разговор'}
            onPress={() => goScenario('')}
          />
        </Animated.View>
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[6], paddingTop: 56, paddingBottom: spacing[10] },

  header: { alignItems: 'center', gap: spacing[2], marginBottom: spacing[5], marginTop: spacing[4] },
  title: { fontFamily: fontFamily.display, fontSize: fontSize['3xl'], color: colors.ink, letterSpacing: -0.5, marginTop: spacing[2] },
  sub: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.inkSoft, textAlign: 'center' },

  customRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[5] },
  customInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.ink,
    borderWidth: 2,
    borderColor: colors.border,
  },
  customBtn: {
    width: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customBtnText: { fontFamily: fontFamily.bodyBlack, fontSize: 24, color: colors.white },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: { width: '48%', marginBottom: spacing[3] },
  topicCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[3],
    alignItems: 'center',
    gap: spacing[2],
  },
  topicEmoji: { fontSize: 34 },
  topicText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.base, color: colors.ink, textAlign: 'center' },
});
