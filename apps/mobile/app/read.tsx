/**
 * Story Reader — storybook warm-up before the main lesson.
 * Shows lesson.story[] scene by scene; vocabulary words highlighted.
 * Params: lang (string), day (number)
 * Route: /read?lang=en&day=3
 */

import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { Icon } from '@/components/Icon';
import { LessonHeader } from '@/components/LessonHeader';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import { useSettings } from '@/store/settings';
import { afterReadingRoute, isMatureLearner } from '@/utils/lessonFlow';
import { colors, fontFamily, fontSize, radius, shadow, spacing, tints } from '@/theme';

const { width: SCREEN_W } = Dimensions.get('window');

// Per-scene background tints — cycles softly
const SCENE_TINTS = [tints.primary, tints.sage, tints.butter, colors.englishLight, tints.berry];
const SCENE_RING = [colors.primary, colors.accent, colors.butterDeep, colors.english, colors.berryDeep];

// Highlight vocabulary words inside story text
function HighlightedText({
  text,
  vocab,
  style,
}: {
  text: string;
  vocab: string[];
  style?: object;
}) {
  if (vocab.length === 0) {
    return <Text style={style}>{text}</Text>;
  }
  // Split text around any vocab word (case-insensitive)
  const pattern = new RegExp(`(${vocab.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(pattern);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        const isWord = vocab.some((w) => w.toLowerCase() === part.toLowerCase());
        return isWord ? (
          <Text key={i} style={styles.highlightWord}>{part}</Text>
        ) : (
          <Text key={i}>{part}</Text>
        );
      })}
    </Text>
  );
}

export default function ReadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lang?: string; day?: string }>();
  const lang = params.lang ?? 'en';
  const day = Number(params.day ?? 1);

  const uiLang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const storedHue = useSettings((s) => s.petHue);
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const isAz = uiLang === 'az';

  const lesson = getLesson(lang, day);
  const scenes = lesson?.story ?? [];
  const vocab = lesson?.vocabulary ?? [];
  const theme = lesson?.theme ?? '';

  // Lesson route after reading: kids → playful mode rotation; teens/B1+ →
  // straight to level-appropriate grammar, then talk (text-first flow).
  const childLevel = useSettings((s) => s.childLevel);
  const childAgeBand = useSettings((s) => s.childAgeBand);
  const firstLang = learningLanguages[0] ?? lang;
  const mature = isMatureLearner(childLevel, childAgeBand);
  const lessonRoute = afterReadingRoute(day, firstLang, mature);
  const childId = useSettings((s) => s.childId);
  const markLessonStep = useSettings((s) => s.markLessonStep);

  const [sceneIdx, setSceneIdx] = useState(0);
  const isLast = sceneIdx === scenes.length - 1;

  // Bounce scale on scene change
  const scale = useSharedValue(1);
  const emojiStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function goNext() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    scale.value = withSpring(1.15, { damping: 6 }, () => {
      scale.value = withSpring(1, { damping: 10 });
    });
    setSceneIdx((i) => Math.min(i + 1, scenes.length - 1));
  }

  function goPrev() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSceneIdx((i) => Math.max(i - 1, 0));
  }

  function startLesson() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // У старших чтение — первый шаг урока дня; у малышей это сказка, не шаг.
    if (mature && childId) markLessonStep(childId, firstLang, day, 'reading');
    router.replace(lessonRoute as any);
  }

  if (scenes.length === 0) {
    // No story data — go straight to lesson
    router.replace(lessonRoute as any);
    return null;
  }

  const scene = scenes[sceneIdx]!;
  const tint = SCENE_TINTS[sceneIdx % SCENE_TINTS.length]!;
  const ring = SCENE_RING[sceneIdx % SCENE_RING.length]!;

  return (
    <PaperBackground>
      <LessonHeader
        title={theme || (isAz ? 'Hekayə' : 'История')}
        icon="book-open"
        step={sceneIdx + 1}
        total={scenes.length}
      />

      {/* Main story card */}
      <View style={styles.storyArea}>
        <Animated.View
          key={sceneIdx}
          entering={FadeInDown.duration(350)}
          exiting={FadeOut.duration(200)}
          style={{ flex: 1 }}
        >
          <HBCard depth="deep" ringColor={ring} style={styles.storyCard}>
            {/* Big emoji illustration */}
            <Animated.View style={[styles.emojiHalo, { backgroundColor: tint }, emojiStyle]}>
              <Text style={styles.sceneEmoji}>{scene.emoji}</Text>
            </Animated.View>

            {/* Story text with highlighted vocab */}
            <HighlightedText
              text={scene.text}
              vocab={vocab}
              style={styles.storyText}
            />

            {/* Vocabulary row */}
            {vocab.length > 0 && (
              <View style={styles.vocabRow}>
                {vocab.map((word, i) => (
                  <View
                    key={word}
                    style={[styles.vocabChip, { backgroundColor: SCENE_TINTS[i % SCENE_TINTS.length] }]}
                  >
                    <Text style={styles.vocabChipText}>{word}</Text>
                  </View>
                ))}
              </View>
            )}
          </HBCard>
        </Animated.View>

        {/* Navigation row */}
        <Animated.View entering={FadeInUp.duration(400).delay(150)} style={styles.navRow}>
          {/* Prev button */}
          <Pressable
            style={[styles.navBtn, sceneIdx === 0 && styles.navBtnDisabled]}
            onPress={sceneIdx > 0 ? goPrev : undefined}
            disabled={sceneIdx === 0}
            accessibilityRole="button"
            accessibilityLabel={isAz ? 'Geri' : 'Назад'}
          >
            <Icon name="chevron-left" size={22} color={colors.ink} strokeWidth={2.5} />
          </Pressable>

          {/* Center: pet or start lesson */}
          <View style={styles.navCenter}>
            {isLast ? (
              <HBButton
                label={isAz ? 'Dərsi başlat' : 'Начать урок'}
                icon="play"
                variant="primary"
                onPress={startLesson}
                full
              />
            ) : (
              <HBButton
                label={isAz ? 'Davam et' : 'Дальше'}
                iconRight="chevron-right"
                variant="soft"
                onPress={goNext}
                full
              />
            )}
          </View>

          {/* Next button (hidden on last to avoid double CTA) */}
          {!isLast ? (
            <Pressable
              style={styles.navBtn}
              onPress={goNext}
              accessibilityRole="button"
              accessibilityLabel={isAz ? 'İrəli' : 'Вперёд'}
            >
              <Icon name="chevron-right" size={22} color={colors.ink} strokeWidth={2.5} />
            </Pressable>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </Animated.View>

        {/* Bobo reaction at bottom */}
        <Animated.View entering={FadeIn.duration(500).delay(300)} style={styles.petRow}>
          <HBPet
            size={56}
            hue={storedHue}
            mood={isLast ? 'happy' : 'curious'}
          />
          <HBCard depth="sm" style={styles.petBubble}>
            <Text style={styles.petBubbleText}>
              {isLast
                ? (isAz ? 'Əla! İndi dərsi başlayaq!' : 'Отлично! Теперь начнём урок!')
                : sceneIdx === 0
                ? (isAz ? 'Hekayəni oxu!' : 'Читай историю!')
                : (isAz ? 'Davam et!' : 'Продолжай!')}
            </Text>
          </HBCard>
        </Animated.View>
      </View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  // Story area
  storyArea: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[5],
    gap: spacing[3],
  },
  storyCard: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[6],
  },

  emojiHalo: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255,255,255,0.85)',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(125,90,42,0.1)',
    ...shadow.md,
  },
  sceneEmoji: { fontSize: 64 },

  storyText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.lg,
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: spacing[2],
    flex: 1,
  },
  highlightWord: {
    fontFamily: fontFamily.bodyBlack,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: 4,
  },

  vocabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    justifyContent: 'center',
    marginTop: 'auto',
  },
  vocabChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  vocabChipText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },

  // Nav row
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.4 },
  navCenter: { flex: 1 },

  // Pet row
  petRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[3],
  },
  petBubble: { flex: 1, paddingVertical: spacing[2] },
  petBubbleText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.ink,
    lineHeight: 19,
  },
});
