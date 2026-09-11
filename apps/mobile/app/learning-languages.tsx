import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { getStrings } from '@/i18n/strings';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, gradients, radius, scaleFont, shadow, spacing } from '@/theme';
import type { LanguageCode } from '@soz/shared-types';

type Choice = 'en_only' | 'ru_only' | 'both';

export default function LearningLanguagesScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const setLearningLanguages = useSettings((s) => s.setLearningLanguages);
  const profileType = useSettings((s) => s.profileType);
  const t = getStrings(lang);

  const [selected, setSelected] = useState<Choice>('both');

  const handleContinue = () => {
    const langs: LanguageCode[] =
      selected === 'en_only' ? ['en'] : selected === 'ru_only' ? ['ru'] : ['en', 'ru'];
    setLearningLanguages(langs);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Adults skip the kid chain (name/interests/age/pet) and go to their own setup.
    router.push((profileType === 'adult' ? '/setup/goal' : '/setup/name') as never);
  };

  return (
    <Screen gradient decoration="sunrise" scroll>
      <Animated.View entering={FadeInUp.duration(500).delay(80)} style={{ marginTop: spacing[6] }}>
        <Text variant="label" tone="bobo">
          {lang === 'az' ? 'Addım 1 / 4' : 'Шаг 1 из 4'}
        </Text>
        <Text variant="title" style={{ marginTop: spacing[2] }}>
          {t.learningLanguages.title}
        </Text>
        <Text variant="subtitle" tone="secondary" style={{ marginTop: spacing[3] }}>
          {t.learningLanguages.subtitle}
        </Text>
      </Animated.View>

      <View style={styles.cards}>
        <Animated.View entering={FadeInUp.duration(500).delay(220)}>
          <RecommendedCard
            selected={selected === 'both'}
            badge={t.learningLanguages.bothBadge}
            title={t.learningLanguages.both}
            description={t.learningLanguages.bothDesc}
            onPress={() => setSelected('both')}
          />
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(340)}>
          <SimpleCard
            selected={selected === 'en_only'}
            flag="🇬🇧"
            title={t.learningLanguages.onlyEnglish}
            description={t.learningLanguages.onlyEnglishDesc}
            tone={colors.english}
            tint={colors.englishLight}
            onPress={() => setSelected('en_only')}
          />
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(420)}>
          <SimpleCard
            selected={selected === 'ru_only'}
            flag="🇷🇺"
            title={t.learningLanguages.onlyRussian}
            description={t.learningLanguages.onlyRussianDesc}
            tone={colors.russian}
            tint={colors.russianLight}
            onPress={() => setSelected('ru_only')}
          />
        </Animated.View>
      </View>

      <Animated.View entering={FadeInUp.duration(400).delay(560)} style={styles.cta}>
        <Button label={t.common.continue} onPress={handleContinue} />
      </Animated.View>
    </Screen>
  );
}

interface RecommendedCardProps {
  selected: boolean;
  badge: string;
  title: string;
  description: string;
  onPress: () => void;
}

function RecommendedCard({ selected, badge, title, description, onPress }: RecommendedCardProps) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[aStyle, shadow.lg]}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        onPressIn={() => {
          scale.value = withTiming(0.98, { duration: 80 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 120 });
        }}
      >
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.recCard,
            { borderColor: selected ? colors.accentYellow : 'transparent' },
          ]}
        >
          <View style={styles.recBadge}>
            <Text style={{ fontSize: fontSize.xs, fontWeight: '900', color: colors.midnight, letterSpacing: 1 }}>
              ⭐ {badge.toUpperCase()}
            </Text>
          </View>
          <View style={styles.flagsRow}>
            <View style={styles.bigFlag}>
              <Text style={{ fontSize: scaleFont(38) }}>🇬🇧</Text>
            </View>
            <Text style={{ color: colors.white, fontSize: scaleFont(28), fontFamily: fontFamily.bodyBlack }}>+</Text>
            <View style={styles.bigFlag}>
              <Text style={{ fontSize: scaleFont(38) }}>🇷🇺</Text>
            </View>
          </View>
          <Text
            style={{
              color: colors.white,
              fontFamily: fontFamily.display,
              fontSize: fontSize['3xl'],
              marginTop: spacing[5],
              letterSpacing: -0.4,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              color: colors.primarySoft,
              fontSize: fontSize.base,
              marginTop: spacing[2],
              lineHeight: 22,
            }}
          >
            {description}
          </Text>
          <RadioMark selected={selected} onLight />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

interface SimpleCardProps {
  selected: boolean;
  flag: string;
  title: string;
  description: string;
  tone: string;
  tint: string;
  onPress: () => void;
}

function SimpleCard({ selected, flag, title, description, tone, tint, onPress }: SimpleCardProps) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[aStyle, selected ? shadow.md : shadow.sm]}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        onPressIn={() => {
          scale.value = withTiming(0.98, { duration: 80 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 120 });
        }}
        style={[
          styles.simpleCard,
          {
            backgroundColor: colors.white,
            borderColor: selected ? tone : colors.border,
          },
        ]}
      >
        <View style={[styles.smallFlag, { backgroundColor: tint }]}>
          <Text style={{ fontSize: fontSize['3xl'] }}>{flag}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fontFamily.bodyBlack, fontSize: fontSize.lg }}>{title}</Text>
          <Text variant="caption" tone="secondary" style={{ marginTop: 4 }}>
            {description}
          </Text>
        </View>
        <RadioMark selected={selected} accent={tone} />
      </Pressable>
    </Animated.View>
  );
}

function RadioMark({ selected, accent, onLight }: { selected: boolean; accent?: string; onLight?: boolean }) {
  return (
    <View
      style={[
        styles.radioOuter,
        {
          borderColor: selected ? accent ?? colors.accentYellow : onLight ? colors.primarySoft : colors.borderStrong,
          backgroundColor: selected ? (accent ?? colors.accentYellow) : 'transparent',
          alignSelf: onLight ? 'flex-end' : 'center',
          marginTop: onLight ? spacing[4] : 0,
        },
      ]}
    >
      {selected ? <View style={styles.radioInner} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cards: {
    gap: spacing[3],
    marginTop: spacing[8],
  },
  cta: { marginTop: spacing[8] },

  recCard: {
    padding: spacing[6],
    borderRadius: radius['2xl'],
    borderWidth: 3,
    overflow: 'hidden',
  },
  recBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentYellow,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    marginBottom: spacing[5],
  },
  flagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  bigFlag: {
    width: 70,
    height: 70,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  simpleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    borderRadius: radius.xl,
    gap: spacing[4],
    borderWidth: 2,
  },
  smallFlag: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.midnight,
  },
});
