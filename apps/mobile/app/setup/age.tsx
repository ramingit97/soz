/**
 * Honeybear · Age picker (Step 4).
 *
 * Instead of an exact-age wheel, the parent picks an AGE RANGE aligned to the
 * Azerbaijani school structure (1st grade at 6; primary 1–4; middle/high to
 * ~10th grade). Each range maps (via AGE_RANGE_META in the store) to:
 *   • a representative age + ageBand (AI prompt register),
 *   • a visual register (playful & colorful under ~10, calmer above),
 *   • an engine mode (younger = gamified play; 14–16 = conversation-first).
 * The actual level is chosen on the next screen (pre-selected from the range).
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { HBBackButton } from '@/components/HBBackButton';
import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import type { AgeRange } from '@/store/settings';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing, tints } from '@/theme';
import { useCompanionName } from '@/utils/companion';
import { StepIndicator } from './name';

interface RangeOption {
  key: AgeRange;
  emoji: string;
  rangeLabel: string;
  stageRu: string;
  stageAz: string;
  color: string;
  tint: string;
}

// Note: 'adult' is reached via the profile-type fork, not this kid-path screen.
const RANGES: RangeOption[] = [
  {
    key: '5-7',
    emoji: '🧸',
    rangeLabel: '5–7',
    stageRu: 'До школы / 1 класс',
    stageAz: 'Məktəbəqədər / 1-ci sinif',
    color: colors.berry,
    tint: tints.berry,
  },
  {
    key: '8-10',
    emoji: '🎒',
    rangeLabel: '8–10',
    stageRu: 'Начальные классы',
    stageAz: 'İbtidai siniflər',
    color: colors.primary,
    tint: colors.primarySoft,
  },
  {
    key: '11-13',
    emoji: '📘',
    rangeLabel: '11–13',
    stageRu: 'Средние классы',
    stageAz: 'Orta siniflər',
    color: colors.accent,
    tint: '#E8FBF5',
  },
  {
    key: '14-16',
    emoji: '🎓',
    rangeLabel: '14–16',
    stageRu: 'Старшие классы · разговорный',
    stageAz: 'Yuxarı siniflər · danışıq',
    color: colors.english,
    tint: colors.englishLight,
  },
];

export default function SetupAgeScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const existingRange = useSettings((s) => s.childAgeRange);
  const setChildAgeRange = useSettings((s) => s.setChildAgeRange);

  const companion = useCompanionName();

  const isAz = lang === 'az';
  const [selected, setSelected] = useState<AgeRange | null>(existingRange);

  const handleSelect = (range: AgeRange) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected(range);
  };

  const handleContinue = () => {
    if (!selected) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setChildAgeRange(selected);
    // Level-first: pick the level yourself; the level screen offers an optional
    // placement check ("Не уверен — проверь меня") for teens who want one.
    router.push('/setup/level' as any);
  };

  return (
    <PaperBackground>
      {/* ScrollView, а не View: вариантов возраста ЧЕТЫРЕ, и на 320 × 712 dp
          четвёртая карточка («14–16») не влезала — она оказывалась под панелью
          навигации, а прокрутки не было. Подростка выбрать было физически
          невозможно, при том что для него есть отдельный режим движка
          (conversation-first, см. шапку файла). */}
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* top row: back + step + spacer */}
        <View style={styles.topBar}>
          <HBBackButton inline />
          <View style={{ flex: 1 }} />
          <View style={{ width: 36 }} />
        </View>

        <StepIndicator current={4} total={7} />

        {/* title */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.titleBlock}>
          <HBPet size={56} mood="happy" />
          <Text style={styles.title}>{isAz ? 'Neçə yaşı var?' : 'Сколько лет ребёнку?'}</Text>
          <Text style={styles.subtitle}>
            {isAz ? `${companion} yaşa uyğun dərslər seçəcək` : `${companion} подберёт уроки под возраст`}
          </Text>
        </Animated.View>

        {/* range cards */}
        <View style={styles.cards}>
          {RANGES.map((r, i) => (
            <Animated.View key={r.key} entering={FadeInUp.duration(450).delay(150 + i * 90)}>
              <RangeCard
                option={r}
                selected={selected === r.key}
                isAz={isAz}
                onPress={() => handleSelect(r.key)}
              />
            </Animated.View>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <View style={[styles.cta, { opacity: selected ? 1 : 0.45 }]}>
          <HBButton
            full
            variant="primary"
            label={isAz ? 'Davam et' : 'Продолжить'}
            disabled={!selected}
            onPress={handleContinue}
          />
        </View>
      </ScrollView>
    </PaperBackground>
  );
}

function RangeCard({
  option,
  selected,
  isAz,
  onPress,
}: {
  option: RangeOption;
  selected: boolean;
  isAz: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[aStyle, selected ? shadow.md : shadow.sm]}>
      <Pressable
        onPress={() => {
          scale.value = withSpring(0.97, {}, () => {
            scale.value = withSpring(1);
          });
          onPress();
        }}
        style={[
          styles.card,
          {
            borderColor: selected ? option.color : 'transparent',
            backgroundColor: selected ? option.tint : colors.card,
          },
        ]}
      >
        <View style={[styles.emojiBox, { backgroundColor: selected ? option.color + '26' : colors.bgDeep }]}>
          <Text style={{ fontSize: 30 }}>{option.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rangeLabel, selected && { color: option.color }]}>
            {option.rangeLabel} {isAz ? 'yaş' : 'лет'}
          </Text>
          <Text style={styles.stage}>{isAz ? option.stageAz : option.stageRu}</Text>
        </View>
        <View style={[styles.radio, selected && { backgroundColor: option.color, borderColor: option.color }]}>
          {selected && <View style={styles.radioDot} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    // flexGrow вместо flex внутри ScrollView: когда содержимое короче экрана,
    // распорка ниже прижимает кнопку к низу как раньше; когда длиннее —
    // распорка сжимается в ноль и экран просто прокручивается.
    flexGrow: 1,
    paddingHorizontal: spacing[6],
    paddingTop: 50,
    paddingBottom: spacing[6],
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  stepText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    letterSpacing: 0.6,
  },

  titleBlock: {
    alignItems: 'center',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'],
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: spacing[1],
  },
  subtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
  },

  cards: {
    gap: spacing[3],
    marginTop: spacing[6],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 2,
  },
  emojiBox: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeLabel: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  stage: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 2,
  },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.white },

  cta: {
    paddingTop: spacing[3],
  },
});
