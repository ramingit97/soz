/**
 * Interactive Story — choose-your-own-adventure using the day's lesson vocabulary.
 * 4 rotating archetypes (lost/friend/door/treasure). No backend needed:
 * story nodes are generated from lesson.theme + lesson.vocabulary.
 * Route: /story?lang=en&day=3
 */

import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { HBBackButton } from '@/components/HBBackButton';
import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import { useSettings } from '@/store/settings';
import { useCompanionName } from '@/utils/companion';
import { afterReadingRoute, isMatureLearner } from '@/utils/lessonFlow';
import { colors, fontFamily, fontSize, radius, shadow, spacing, tints } from '@/theme';

// ─── Story data model ─────────────────────────────────────────────────────────

interface StoryChoice {
  label: string;
  emoji: string;
  nextId: string;
}

interface StoryNode {
  id: string;
  sceneEmoji: string;
  sceneTint: string;
  text: string;
  choices?: StoryChoice[];
  isEnding?: boolean;
  stars?: number;
  petMood?: 'happy' | 'curious' | 'sleepy' | 'sad';
}

// ─── Story archetypes (4, rotate by day) ─────────────────────────────────────

function buildStory(
  theme: string,
  themeEmoji: string,
  vocab: string[],
  archetype: number,
): StoryNode[] {
  const w = (i: number) => vocab[i] ?? '✨';

  const archetypes: StoryNode[][] = [
    // 0 — Lost in the forest
    [
      {
        id: 'start',
        sceneEmoji: themeEmoji,
        sceneTint: tints.primary,
        text: `Хани шёл по лесу и вдруг увидел ${themeEmoji}.\nОн не знал, что делать!`,
        choices: [
          { label: w(0), emoji: '👋', nextId: 'a1' },
          { label: w(1), emoji: '🤔', nextId: 'b1' },
        ],
        petMood: 'curious',
      },
      {
        id: 'a1',
        sceneEmoji: '😊',
        sceneTint: tints.sage,
        text: `«${w(0)}!» — сказал Хани.\n${themeEmoji} очень обрадовался и показал дорогу домой!`,
        choices: [
          { label: w(2), emoji: '🎵', nextId: 'end1' },
          { label: w(3), emoji: '⭐', nextId: 'end2' },
        ],
        petMood: 'happy',
      },
      {
        id: 'b1',
        sceneEmoji: '🌟',
        sceneTint: colors.englishLight,
        text: `«${w(1)}!» — прошептал Хани.\nВдруг из-за дерева выглянул волшебный зверёк!`,
        choices: [
          { label: w(2), emoji: '🤝', nextId: 'end3' },
          { label: w(4), emoji: '🎁', nextId: 'end4' },
        ],
        petMood: 'curious',
      },
      {
        id: 'end1',
        sceneEmoji: '🏆',
        sceneTint: tints.butter,
        text: `«${w(2)}!» — воскликнул Хани.\nВсе друзья собрались вместе и устроили праздник! 🎉`,
        isEnding: true,
        stars: 3,
        petMood: 'happy',
      },
      {
        id: 'end2',
        sceneEmoji: '✨',
        sceneTint: tints.primary,
        text: `«${w(3)}!» — пропел Хани.\nЗвёзды засветились, и Хани нашёл дорогу домой! 🌟`,
        isEnding: true,
        stars: 3,
        petMood: 'happy',
      },
      {
        id: 'end3',
        sceneEmoji: '🤝',
        sceneTint: tints.sage,
        text: `«${w(2)}!» — сказал Хани новому другу.\nОни вместе отправились домой! Дружба — это сила! 💚`,
        isEnding: true,
        stars: 3,
        petMood: 'happy',
      },
      {
        id: 'end4',
        sceneEmoji: '🎁',
        sceneTint: colors.englishLight,
        text: `«${w(4)}!» — засмеялся Хани.\nВолшебный зверёк подарил ему сундук сокровищ! 💜`,
        isEnding: true,
        stars: 3,
        petMood: 'happy',
      },
    ],

    // 1 — New friend
    [
      {
        id: 'start',
        sceneEmoji: '🤝',
        sceneTint: tints.sage,
        text: `Хани встретил нового друга — ${themeEmoji}.\nКак познакомиться?`,
        choices: [
          { label: w(0), emoji: '👋', nextId: 'a1' },
          { label: w(1), emoji: '😄', nextId: 'b1' },
        ],
        petMood: 'curious',
      },
      {
        id: 'a1',
        sceneEmoji: themeEmoji,
        sceneTint: tints.primary,
        text: `«${w(0)}!» — крикнул Хани.\n${themeEmoji} улыбнулся и сказал: «Пойдём играть!»`,
        choices: [
          { label: w(2), emoji: '⚽', nextId: 'end1' },
          { label: w(3), emoji: '🎨', nextId: 'end2' },
        ],
        petMood: 'happy',
      },
      {
        id: 'b1',
        sceneEmoji: '🌈',
        sceneTint: tints.butter,
        text: `«${w(1)}!» — засмеялся Хани.\nВокруг появилась радуга! Друг удивился!`,
        choices: [
          { label: w(2), emoji: '🌟', nextId: 'end3' },
          { label: w(4), emoji: '🍀', nextId: 'end4' },
        ],
        petMood: 'happy',
      },
      {
        id: 'end1',
        sceneEmoji: '⚽',
        sceneTint: tints.english,
        text: `«${w(2)}!» — позвал Хани.\nОни играли весь день и стали лучшими друзьями! 🏆`,
        isEnding: true,
        stars: 3,
        petMood: 'happy',
      },
      {
        id: 'end2',
        sceneEmoji: '🎨',
        sceneTint: tints.primary,
        text: `«${w(3)}!» — предложил Хани.\nОни нарисовали картину вместе! Вышел шедевр! 🎉`,
        isEnding: true,
        stars: 3,
        petMood: 'happy',
      },
      {
        id: 'end3',
        sceneEmoji: '🌟',
        sceneTint: tints.butter,
        text: `«${w(2)}!» — воскликнул Хани.\nЗвезда упала прямо к ним! Желание сбылось! ⭐`,
        isEnding: true,
        stars: 3,
        petMood: 'happy',
      },
      {
        id: 'end4',
        sceneEmoji: '🍀',
        sceneTint: tints.sage,
        text: `«${w(4)}!» — прошептал Хани.\nЧетырёхлистный клевер принёс удачу всем! 🍀`,
        isEnding: true,
        stars: 3,
        petMood: 'happy',
      },
    ],

    // 2 — Magic door
    [
      {
        id: 'start',
        sceneEmoji: '🚪',
        sceneTint: colors.englishLight,
        text: `Хани нашёл волшебную дверь!\nВ ней было написано слово. Какое ты выбираешь?`,
        choices: [
          { label: w(0), emoji: '✨', nextId: 'a1' },
          { label: w(1), emoji: '🔮', nextId: 'b1' },
        ],
        petMood: 'curious',
      },
      {
        id: 'a1',
        sceneEmoji: themeEmoji,
        sceneTint: tints.primary,
        text: `Дверь открылась! За ней — ${themeEmoji}!\nЧто сказать этому чуду?`,
        choices: [
          { label: w(2), emoji: '🌟', nextId: 'end1' },
          { label: w(3), emoji: '🎶', nextId: 'end2' },
        ],
        petMood: 'happy',
      },
      {
        id: 'b1',
        sceneEmoji: '🌌',
        sceneTint: tints.berry,
        text: `«${w(1)}!» — сказал Хани.\nДверь улетела в небо и унесла их в облака!`,
        choices: [
          { label: w(2), emoji: '☁️', nextId: 'end3' },
          { label: w(4), emoji: '🌈', nextId: 'end4' },
        ],
        petMood: 'curious',
      },
      {
        id: 'end1',
        sceneEmoji: '🏅',
        sceneTint: tints.butter,
        text: `«${w(2)}!» — объявил Хани.\nВолшебный мир подарил ему золотую медаль! 🏅`,
        isEnding: true,
        stars: 3,
        petMood: 'happy',
      },
      {
        id: 'end2',
        sceneEmoji: '🎶',
        sceneTint: tints.sage,
        text: `«${w(3)}!» — запел Хани.\nВся страна запела вместе с ним! 🎵`,
        isEnding: true,
        stars: 3,
        petMood: 'happy',
      },
      {
        id: 'end3',
        sceneEmoji: '☁️',
        sceneTint: colors.englishLight,
        text: `«${w(2)}!» — закричал Хани в облаках.\nОблако стало мягкой кроватью для отдыха! 💜`,
        isEnding: true,
        stars: 3,
        petMood: 'happy',
      },
      {
        id: 'end4',
        sceneEmoji: '🌈',
        sceneTint: tints.primary,
        text: `«${w(4)}!» — произнёс Хани.\nРадуга стала мостом прямо домой! 🎉`,
        isEnding: true,
        stars: 3,
        petMood: 'happy',
      },
    ],

    // 3 — Treasure hunt
    [
      {
        id: 'start',
        sceneEmoji: '🗺️',
        sceneTint: tints.butter,
        text: `Хани нашёл карту сокровищ!\nПервая подсказка: скажи слово и иди!`,
        choices: [
          { label: w(0), emoji: '➡️', nextId: 'a1' },
          { label: w(1), emoji: '⬆️', nextId: 'b1' },
        ],
        petMood: 'curious',
      },
      {
        id: 'a1',
        sceneEmoji: themeEmoji,
        sceneTint: tints.primary,
        text: `Правильно! Хани нашёл ${themeEmoji}!\nВторая подсказка спрятана здесь. Выбери слово!`,
        choices: [
          { label: w(2), emoji: '🔍', nextId: 'end1' },
          { label: w(3), emoji: '🗝️', nextId: 'end2' },
        ],
        petMood: 'happy',
      },
      {
        id: 'b1',
        sceneEmoji: '🏔️',
        sceneTint: tints.sage,
        text: `«${w(1)}!» — Хани забрался на гору.\nСнизу видна вся карта! Что дальше?`,
        choices: [
          { label: w(2), emoji: '🌊', nextId: 'end3' },
          { label: w(4), emoji: '🌲', nextId: 'end4' },
        ],
        petMood: 'curious',
      },
      {
        id: 'end1',
        sceneEmoji: '💎',
        sceneTint: colors.englishLight,
        text: `«${w(2)}!» — сундук открылся!\nВнутри — бриллианты и письмо: «Ты молодец!» 💎`,
        isEnding: true,
        stars: 3,
        petMood: 'happy',
      },
      {
        id: 'end2',
        sceneEmoji: '🗝️',
        sceneTint: tints.butter,
        text: `Ключ подошёл! «${w(3)}!» — воскликнул Хани.\nСокровище нашлось — это дружба! 🤝`,
        isEnding: true,
        stars: 3,
        petMood: 'happy',
      },
      {
        id: 'end3',
        sceneEmoji: '🌊',
        sceneTint: tints.english,
        text: `«${w(2)}!» — Хани нырнул!\nПод водой он нашёл подводный дворец! 🏰`,
        isEnding: true,
        stars: 3,
        petMood: 'happy',
      },
      {
        id: 'end4',
        sceneEmoji: '🌲',
        sceneTint: tints.sage,
        text: `«${w(4)}!» — в лесу ожил волшебный дуб.\nОн подарил Хани шапку-невидимку! ✨`,
        isEnding: true,
        stars: 3,
        petMood: 'happy',
      },
    ],
  ];

  return archetypes[archetype % archetypes.length]!;
}

// ─── Star burst component ─────────────────────────────────────────────────────

function StarBurst({ count }: { count: number }) {
  return (
    <View style={styles.starBurst}>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.Text
          key={i}
          entering={FadeInDown.duration(400).delay(i * 120)}
          style={styles.starBurstStar}
        >
          ⭐
        </Animated.Text>
      ))}
    </View>
  );
}

// ─── Choice card ─────────────────────────────────────────────────────────────

function ChoiceCard({
  choice,
  onPress,
  index,
}: {
  choice: StoryChoice;
  onPress: () => void;
  index: number;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePress() {
    scale.value = withSequence(
      withSpring(0.93, { damping: 8 }),
      withSpring(1, { damping: 10 }),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  }

  const textColors = [colors.primary, colors.accent];

  return (
    <Animated.View
      entering={FadeInUp.duration(350).delay(100 + index * 80)}
      style={[animStyle, { flex: 1 }]}
    >
      <Pressable onPress={handlePress} style={{ flex: 1 }}>
        <HBCard depth="md" ringColor={textColors[index % 2]} style={styles.choiceCard}>
          <Text style={styles.choiceEmoji}>{choice.emoji}</Text>
          <Text style={[styles.choiceWord, { color: textColors[index % 2] }]}>
            {choice.label}
          </Text>
        </HBCard>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function StoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lang?: string; day?: string }>();
  const lang = params.lang ?? 'en';
  const day = Number(params.day ?? 1);

  const uiLang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const storedHue = useSettings((s) => s.petHue);
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const childLevel = useSettings((s) => s.childLevel);
  const childAgeBand = useSettings((s) => s.childAgeBand);
  const bot = useCompanionName();
  const isAz = uiLang === 'az';

  const lesson = getLesson(lang, day);
  const vocab = lesson?.vocabulary ?? [];
  const themeEmoji = lesson?.themeEmoji ?? '📖';
  const theme = lesson?.theme ?? '';

  const archetype = (day - 1) % 4;
  const rawNodes = buildStory(theme, themeEmoji, vocab, archetype);
  // Story archetypes are authored with "Хани"; swap in the child's pet name.
  const nodes =
    bot && bot !== 'Хани'
      ? rawNodes.map((n) => ({ ...n, text: n.text.replace(/Хани/g, bot) }))
      : rawNodes;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const firstLang = learningLanguages[0] ?? lang;
  // Kids continue into the playful mode; teens/B1+ go text-first → grammar.
  const lessonRoute = afterReadingRoute(day, firstLang, isMatureLearner(childLevel, childAgeBand));

  const [nodeId, setNodeId] = useState('start');
  const [history, setHistory] = useState<string[]>(['start']);

  const emojiScale = useSharedValue(1);
  const emojiStyle = useAnimatedStyle(() => ({ transform: [{ scale: emojiScale.value }] }));

  const node = nodeMap.get(nodeId) ?? nodes[0]!;

  function choose(nextId: string) {
    emojiScale.value = withSequence(
      withTiming(1.2, { duration: 150 }),
      withSpring(1, { damping: 8 }),
    );
    setHistory((h) => [...h, nextId]);
    setNodeId(nextId);
  }

  function startLesson() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    router.replace(lessonRoute as any);
  }

  return (
    <PaperBackground variant="honey">
      {/* Top bar */}
      <View style={styles.topBar}>
        <HBBackButton inline />
        <View style={styles.topCenter}>
          <Text style={styles.topEmoji}>{themeEmoji}</Text>
          <Text style={styles.topTitle}>
            {isAz ? 'Macəra' : 'Приключение'}
          </Text>
        </View>
        {/* Path breadcrumb */}
        <View style={styles.breadcrumb}>
          {history.map((_, i) => (
            <View key={i} style={[styles.crumb, i === history.length - 1 && styles.crumbActive]} />
          ))}
        </View>
      </View>

      {/* Scene */}
      <Animated.View
        key={nodeId}
        entering={FadeIn.duration(350)}
        exiting={FadeOut.duration(200)}
        style={styles.scene}
      >
        {/* Emoji illustration */}
        <Animated.View style={[styles.emojiHalo, { backgroundColor: node.sceneTint }, emojiStyle]}>
          <Text style={styles.sceneEmoji}>{node.sceneEmoji}</Text>
        </Animated.View>

        {/* Story card */}
        <HBCard depth="deep" style={styles.storyCard}>
          {node.isEnding && node.stars ? (
            <StarBurst count={node.stars} />
          ) : null}
          <Text style={styles.storyText}>{node.text}</Text>
          {/* Pet reaction */}
          <View style={styles.petRow}>
            <HBPet size={44} hue={storedHue} mood={node.petMood ?? 'curious'} />
            <View style={styles.petBubble}>
              <Text style={styles.petBubbleText}>
                {node.isEnding
                  ? (isAz ? `${bot} çox xoşbəxtdir! 🎉` : `${bot} очень счастлив! 🎉`)
                  : (isAz ? 'Sən seç!' : 'Ты выбираешь!')}
              </Text>
            </View>
          </View>
        </HBCard>

        {/* Choices or ending CTA */}
        {node.isEnding ? (
          <Animated.View entering={FadeInUp.duration(400).delay(300)} style={styles.endingCTA}>
            <HBButton
              label={isAz ? 'Dərsi başlat 🚀' : 'Начать урок 🚀'}
              variant="primary"
              full
              onPress={startLesson}
            />
            <Pressable onPress={() => router.back()} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnText}>
                {isAz ? 'Geri' : 'Назад'}
              </Text>
            </Pressable>
          </Animated.View>
        ) : node.choices ? (
          <Animated.View entering={FadeInUp.duration(400).delay(200)} style={styles.choicesRow}>
            {node.choices.map((choice, i) => (
              <ChoiceCard
                key={choice.nextId}
                choice={choice}
                index={i}
                onPress={() => choose(choice.nextId)}
              />
            ))}
          </Animated.View>
        ) : null}
      </Animated.View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: 52,
    paddingBottom: spacing[3],
    gap: spacing[3],
  },
  topCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 },
  topEmoji: { fontSize: 20 },
  topTitle: { fontFamily: fontFamily.display, fontSize: fontSize.base, color: colors.ink },
  breadcrumb: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  crumb: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(125,90,42,0.2)',
  },
  crumbActive: {
    width: 20,
    backgroundColor: colors.primary,
  },

  // Scene layout
  scene: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[6],
    gap: spacing[4],
    alignItems: 'center',
  },

  // Emoji illustration
  emojiHalo: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2.5,
    borderTopColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(125,90,42,0.12)',
    ...shadow.md,
  },
  sceneEmoji: { fontSize: 72 },

  // Story card
  storyCard: {
    width: '100%',
    gap: spacing[4],
  },
  storyText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.lg,
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 28,
  },

  // Pet row
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingTop: spacing[1],
  },
  petBubble: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  petBubbleText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },

  // Star burst
  starBurst: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  starBurstStar: { fontSize: 30 },

  // Choice cards
  choicesRow: {
    flexDirection: 'row',
    gap: spacing[3],
    width: '100%',
  },
  choiceCard: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[5],
    minHeight: 110,
    justifyContent: 'center',
  },
  choiceEmoji: { fontSize: 32 },
  choiceWord: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    textAlign: 'center',
  },

  // Ending CTA
  endingCTA: {
    width: '100%',
    gap: spacing[3],
    paddingTop: spacing[2],
  },
  ghostBtn: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  ghostBtnText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
});
