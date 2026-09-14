import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Bobo } from '@/components/Bobo';
import { HBButton } from '@/components/HBButton';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { getStrings } from '@/i18n/strings';
import { useCompanionName, withCompanionName } from '@/utils/companion';
import { useSettings } from '@/store/settings';
import { colors, fontSize, radius, scaleFont, shadow, spacing } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  key: string;
  title: string;
  body: string;
  illustration: 'bobo-talk' | 'progress' | 'gift';
}

export default function TourScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const t = getStrings(lang);
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  // Тур идёт ДО того, как ребёнок назовёт питомца, поэтому обычно здесь стоит
  // имя бренда. Подстановку всё равно применяем: если человек вернётся к туру
  // после переименования, персонаж не должен менять имя на глазах.
  const pet = useCompanionName();
  const slides: Slide[] = [
    { key: '1', title: withCompanionName(t.tour.slide1Title, pet), body: withCompanionName(t.tour.slide1Body, pet), illustration: 'bobo-talk' },
    { key: '2', title: withCompanionName(t.tour.slide2Title, pet), body: withCompanionName(t.tour.slide2Body, pet), illustration: 'progress' },
    { key: '3', title: withCompanionName(t.tour.slide3Title, pet), body: withCompanionName(t.tour.slide3Body, pet), illustration: 'gift' },
  ];

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(newIndex);
  };

  const handleNext = () => {
    if (index < slides.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      router.push('/setup/profile-type' as never);
    }
  };

  const handleSkip = () => router.push('/setup/profile-type' as never);

  return (
    <Screen gradient scroll={false}>
      <View style={styles.topBar}>
        <View style={styles.dots}>
          {slides.map((s, i) => (
            <View
              key={s.key}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? colors.primary : colors.borderStrong,
                  width: i === index ? 28 : 8,
                },
              ]}
            />
          ))}
        </View>
        <HBButton
          label={t.common.skip}
          variant="ghost"
          size="sm"
          onPress={handleSkip}
        />
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item }) => <SlideView slide={item} />}
        getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
        style={{ marginHorizontal: -spacing[6] }}
      />

      <View style={styles.cta}>
        <HBButton full label={index === slides.length - 1 ? t.tour.cta : t.common.next} onPress={handleNext} />
      </View>
    </Screen>
  );
}

function SlideView({ slide }: { slide: Slide }) {
  return (
    <View style={styles.slide}>
      <View style={styles.illustration}>
        {slide.illustration === 'bobo-talk' ? <BoboTalking /> : null}
        {slide.illustration === 'progress' ? <ProgressArt /> : null}
        {slide.illustration === 'gift' ? <GiftArt /> : null}
      </View>

      <Animated.View entering={FadeIn.duration(400)} style={styles.slideText}>
        <Text variant="title" align="center">
          {slide.title}
        </Text>
        <Text
          variant="subtitle"
          tone="secondary"
          align="center"
          style={{ marginTop: spacing[4], paddingHorizontal: spacing[4] }}
        >
          {slide.body}
        </Text>
      </Animated.View>
    </View>
  );
}

function BoboTalking() {
  return (
    <View style={styles.illustrationCenter}>
      <Bobo size={200} mood="curious" />
      <View style={[styles.speechBubble, shadow.md]}>
        <Text style={{ fontSize: fontSize.sm, fontWeight: '700' }}>Hi friend!{'\n'}What's your name?</Text>
        <View style={styles.bubbleTail} />
      </View>
    </View>
  );
}

function ProgressArt() {
  return (
    <View style={styles.illustrationCenter}>
      <View style={[styles.statCard, shadow.lg]}>
        <View style={styles.statRow}>
          <View style={styles.statBadge}>
            <Text style={{ fontSize: scaleFont(22) }}>🇬🇧</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold">English</Text>
            <Text variant="caption" tone="muted">
              Day 7 / 30
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: '23%', backgroundColor: colors.english }]} />
            </View>
          </View>
        </View>
        <View style={[styles.statRow, { marginTop: spacing[4] }]}>
          <View style={[styles.statBadge, { backgroundColor: colors.russianLight }]}>
            <Text style={{ fontSize: scaleFont(22) }}>🇷🇺</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold">Русский</Text>
            <Text variant="caption" tone="muted">
              Day 3 / 30
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: '10%', backgroundColor: colors.russian }]} />
            </View>
          </View>
        </View>
        <View style={styles.streakRow}>
          <View style={styles.streakBadge}>
            <Text style={{ fontSize: 16 }}>🔥</Text>
            <Text style={{ color: colors.accentCoral, fontWeight: '900', fontSize: fontSize.sm }}>7 days</Text>
          </View>
          <View style={[styles.streakBadge, { backgroundColor: colors.primarySoft }]}>
            <Text style={{ fontSize: fontSize.base }}>⭐</Text>
            <Text style={{ color: colors.primary, fontWeight: '900', fontSize: fontSize.sm }}>84 stars</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function GiftArt() {
  return (
    <View style={styles.illustrationCenter}>
      <View style={[styles.giftBox, shadow.lg]}>
        <View style={styles.giftRibbon} />
        <View style={styles.giftRibbonV} />
        <View style={styles.giftBow}>
          <Text style={{ fontSize: 36 }}>🎁</Text>
        </View>
      </View>
      <View style={[styles.daysBadge, shadow.md]}>
        <Text style={{ color: colors.white, fontSize: fontSize.sm, fontWeight: '900', letterSpacing: 1 }}>
          7 DAYS FREE
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
  },
  dots: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: spacing[6],
    flex: 1,
    justifyContent: 'center',
  },
  illustration: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
  },
  illustrationCenter: { alignItems: 'center', justifyContent: 'center' },
  slideText: { marginTop: spacing[8], paddingBottom: spacing[6] },
  cta: { paddingBottom: spacing[4] },

  speechBubble: {
    position: 'absolute',
    top: 30,
    right: -10,
    backgroundColor: colors.white,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.xl,
    borderBottomRightRadius: radius.sm,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -8,
    right: 18,
    width: 16,
    height: 16,
    backgroundColor: colors.white,
    transform: [{ rotate: '45deg' }],
  },

  statCard: {
    backgroundColor: colors.white,
    padding: spacing[5],
    borderRadius: radius['2xl'],
    width: 280,
  },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  statBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.englishLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  streakRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[5],
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: '#FFE5DD',
  },

  giftBox: {
    width: 160,
    height: 160,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftRibbon: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 18,
    marginLeft: -9,
    backgroundColor: colors.accentYellow,
  },
  giftRibbonV: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 18,
    marginTop: -9,
    backgroundColor: colors.accentYellow,
  },
  giftBow: {
    width: 60,
    height: 60,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysBadge: {
    marginTop: spacing[6],
    backgroundColor: colors.accentPink,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: radius.full,
  },
});
