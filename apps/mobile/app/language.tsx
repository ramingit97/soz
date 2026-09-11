import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Bobo } from '@/components/Bobo';
import { Screen } from '@/components/Screen';
import { useCompactScreen } from '@/hooks/useCompactScreen';
import { Text } from '@/components/Text';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

export default function LanguagePickerScreen() {
  const router = useRouter();
  const setParentUILanguage = useSettings((s) => s.setParentUILanguage);

  const float = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [float]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * 8 }],
  }));

  const { short } = useCompactScreen();

  const choose = (lang: 'az' | 'ru') => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setParentUILanguage(lang);
    router.replace('/welcome');
  };

  // Первый экран продукта: маскот 200 dp + заголовок + двуязычный подзаголовок +
  // две карточки языка + сноска. На 320 × 712 dp это влезает без запаса, а любая
  // системная надбавка к размеру шрифта его выносит. scroll — страховка.
  return (
    <Screen gradient decoration="bobo" scroll>
      <View style={styles.center}>
        <Animated.View style={floatStyle} entering={FadeInDown.duration(600).delay(100)}>
          <Bobo size={short ? 140 : 200} mood="curious" />
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(600).delay(300)} style={styles.headerWrap}>
          <Text variant="label" tone="bobo" align="center">
            Söz
          </Text>
          <Text variant="title" align="center" style={{ marginTop: spacing[3] }}>
            Salam! Привет!
          </Text>
          <Text
            variant="subtitle"
            tone="secondary"
            align="center"
            style={{ marginTop: spacing[2] }}
          >
            Hansı dildə davam edək?{'\n'}На каком языке продолжим?
          </Text>
        </Animated.View>

        <View style={styles.cards}>
          <Animated.View
            entering={FadeInUp.duration(500).delay(500)}
            style={{ width: '100%' }}
          >
            <LanguageCard flag="🇦🇿" title="Azərbaycanca" subtitle="Azerbaijani" onPress={() => choose('az')} />
          </Animated.View>
          <Animated.View
            entering={FadeInUp.duration(500).delay(620)}
            style={{ width: '100%' }}
          >
            <LanguageCard flag="🇷🇺" title="Русский" subtitle="Russian" onPress={() => choose('ru')} />
          </Animated.View>
        </View>

        <Animated.View entering={FadeInUp.duration(400).delay(800)}>
          <Text variant="caption" tone="muted" align="center">
            Bunu sonra dəyişə bilərsiniz · Можно изменить позже
          </Text>
        </Animated.View>
      </View>
    </Screen>
  );
}

interface LanguageCardProps {
  flag: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function LanguageCard({ flag, title, subtitle, onPress }: LanguageCardProps) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[aStyle, shadow.md]}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        onPressIn={() => {
          scale.value = withTiming(0.97, { duration: 80 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 120 });
        }}
        style={styles.card}
      >
        <View style={styles.flagBubble}>
          <Text style={{ fontSize: 38 }}>{flag}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fontFamily.bodyBlack, fontSize: fontSize.xl }}>{title}</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.arrowDot}>
          <Text style={{ color: colors.primary, fontSize: 22 }}>›</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  headerWrap: {
    marginTop: spacing[6],
    marginBottom: spacing[10],
    paddingHorizontal: spacing[4],
  },
  cards: {
    width: '100%',
    gap: spacing[3],
    marginBottom: spacing[8],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    borderRadius: radius['2xl'],
    gap: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
  },
  flagBubble: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDot: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
