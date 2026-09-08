import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useSettings, type AgeRange, type ChildLevel } from '@/store/settings';
import { colors, fontFamily, radius, shadow, spacing } from '@/theme';
import { HBButton } from '@/components/HBButton';
import { StepIndicator } from './name';

interface LevelOption {
  key: ChildLevel;
  code: string; // CEFR badge
  emoji: string;
  titleAz: string;
  titleRu: string;
  descAz: string;
  descRu: string;
  color: string;
  tint: string;
}

const LEVELS: LevelOption[] = [
  {
    key: 'beginner',
    code: 'A1',
    emoji: '🌱',
    titleAz: 'Yeni başlayır',
    titleRu: 'Начинающий',
    descAz: 'Demək olar heç bilmir — sıfırdan',
    descRu: 'Почти не знает — начнём с нуля',
    color: colors.accent,
    tint: '#E8FBF5',
  },
  {
    key: 'elementary',
    code: 'A2',
    emoji: '🌿',
    titleAz: 'Elementar',
    titleRu: 'Элементарный',
    descAz: 'Sözlər və sadə ifadələr tanıyır',
    descRu: 'Знает слова и простые фразы',
    color: colors.accentYellow,
    tint: '#FFF8E1',
  },
  {
    key: 'pre_intermediate',
    code: 'B1',
    emoji: '🌳',
    titleAz: 'Orta',
    titleRu: 'Средний',
    descAz: 'Sadə mövzularda söhbət apara bilir',
    descRu: 'Может вести простой разговор',
    color: colors.english,
    tint: colors.englishLight,
  },
  {
    key: 'intermediate',
    code: 'B2',
    emoji: '🚀',
    titleAz: 'Sərbəst',
    titleRu: 'Уверенный',
    descAz: 'Sərbəst danışır, mövzuları müzakirə edir',
    descRu: 'Свободно говорит, обсуждает темы',
    color: colors.primary,
    tint: colors.primarySoft,
  },
];

function suggestedLevelForRange(range: AgeRange | null): ChildLevel {
  switch (range) {
    case '5-7':
    case '8-10':
      return 'beginner';
    case '11-13':
      return 'elementary';
    case '14-16':
      return 'pre_intermediate';
    default:
      return 'beginner';
  }
}

export default function SetupLevelScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const childAge = useSettings((s) => s.childAge) ?? 10;
  const childAgeRange = useSettings((s) => s.childAgeRange);
  const setChildProfile = useSettings((s) => s.setChildProfile);

  // Pre-select the level suggested by the chosen age range (parent can override).
  const [selected, setSelected] = useState<ChildLevel | null>(() => suggestedLevelForRange(childAgeRange));
  const isAz = lang === 'az';

  const handleContinue = () => {
    if (!selected) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setChildProfile(childName, childAge, selected);
    router.push('/setup/goals' as any);
  };

  return (
    <Screen gradient decoration="sunrise" scroll>
      <StepIndicator current={5} total={7} />

      <Animated.View entering={FadeInDown.duration(600).delay(100)} style={styles.header}>
        <Text style={{ fontSize: 52, textAlign: 'center' }}>📚</Text>
        <Text variant="title" align="center" style={{ marginTop: spacing[4] }}>
          {isAz ? `${childName} dili necə bilir?` : `Как ${childName} знает язык?`}
        </Text>
        <Text variant="subtitle" tone="secondary" align="center" style={{ marginTop: spacing[3] }}>
          {isAz ? 'Buna görə tempi və çətinliyi seçəcəyik' : 'Подберём правильный темп и сложность'}
        </Text>
      </Animated.View>

      <View style={styles.cards}>
        {LEVELS.map((lvl, i) => (
          <Animated.View key={lvl.key} entering={FadeInUp.duration(450).delay(180 + i * 90)}>
            <LevelCard
              option={lvl}
              selected={selected === lvl.key}
              isAz={isAz}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setSelected(lvl.key);
              }}
            />
          </Animated.View>
        ))}
      </View>

      {/* Optional placement for teens who aren't sure — choosing a level
          yourself must NEVER force a test (founder decision, 2026-07-04). */}
      {childAgeRange === '14-16' ? (
        <Animated.View entering={FadeInUp.duration(400).delay(500)}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push('/setup/placement' as any);
            }}
            style={styles.placementLink}
            hitSlop={8}
          >
            <Text style={styles.placementLinkText}>
              {isAz ? '🤔 Əmin deyiləm — 1 dəqiqəlik yoxlama' : '🤔 Не уверен — быстрая проверка (1 мин)'}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInUp.duration(400).delay(560)} style={styles.cta}>
        <HBButton
          full
          variant={selected ? 'primary' : 'soft'}
          label={isAz ? 'Davam et' : 'Продолжить'}
          onPress={handleContinue}
          disabled={!selected}
        />
      </Animated.View>
    </Screen>
  );
}

function LevelCard({ option, selected, isAz, onPress }: {
  option: LevelOption; selected: boolean; isAz: boolean; onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[aStyle, selected ? shadow.md : shadow.sm]}>
      <Pressable
        onPress={() => {
          scale.value = withSpring(0.97, {}, () => { scale.value = withSpring(1); });
          onPress();
        }}
        style={[
          styles.card,
          {
            borderColor: selected ? option.color : colors.border,
            backgroundColor: selected ? option.tint : colors.white,
          },
        ]}
      >
        <View style={[styles.codeBadge, { backgroundColor: option.color }]}>
          <Text style={styles.codeBadgeText}>{option.code}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, selected && { color: option.color }]}>
            {option.emoji} {isAz ? option.titleAz : option.titleRu}
          </Text>
          <Text style={styles.cardDesc}>
            {isAz ? option.descAz : option.descRu}
          </Text>
        </View>
        <View style={[styles.radio, selected && { backgroundColor: option.color, borderColor: option.color }]}>
          {selected && <View style={styles.radioDot} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing[4], marginBottom: spacing[4], paddingHorizontal: spacing[2] },
  cards: { gap: spacing[3], marginBottom: spacing[6] },
  placementLink: { alignSelf: 'center', paddingVertical: spacing[2], marginBottom: spacing[2] },
  placementLinkText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 14,
    color: colors.inkSoft,
    textDecorationLine: 'underline',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 2,
  },
  codeBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBadgeText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBlack,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 16,
    color: colors.ink,
  },
  cardDesc: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 2,
    lineHeight: 18,
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
  cta: { paddingBottom: spacing[6] },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center',
    ...shadow.glow,
  },
  btnDisabled: { backgroundColor: colors.border, shadowOpacity: 0, elevation: 0 },
  btnText: { color: colors.white, fontFamily: fontFamily.bodyBlack, fontSize: 17 },
});
