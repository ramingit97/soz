/**
 * Серия дней — праздник на 3, 5, 7, 14 и 30 дней подряд. Открывается поверх
 * экрана «Урок выполнен» и возвращается к нему. Можно поделиться текстом.
 *
 * Фон — приложения, а не свой градиент на каждую серию: пять разных кислотных
 * заливок выглядели как пять разных приложений.
 */

import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Dimensions, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HBButton } from '@/components/HBButton';
import { HBIconBox } from '@/components/HBIconBox';
import { HBPet } from '@/components/HBPet';
import { type IconName } from '@/components/Icon';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { useTheme } from '@/hooks/useTheme';
import { useSettings } from '@/store/settings';
import { fontFamily, scaleFont, spacing } from '@/theme';
import { withCompanionName } from '@/utils/companion';
import { byMode, makeModeStyles } from '@/theme/modeTokens';

const { width: SW, height: SH } = Dimensions.get('window');
const CONFETTI_COLORS_BY_MODE = byMode((t) => ([t.c.primary, t.c.accent, t.c.butter, t.c.berry, t.c.english]));

interface MilestoneInfo {
  icon: IconName;
  titleRu: string;
  titleAz: string;
  msgRu: string;
  msgAz: string;
  /** Текст, которым делятся: эмодзи в нём — часть сообщения, а не иконка. */
  shareRu: string;
  shareAz: string;
}

const MILESTONES: Record<number, MilestoneInfo> = {
  3:  { icon: 'flame', titleRu: '3 дня подряд!',  titleAz: '3 gün ardıcıl!',
        msgRu: 'Бобо гордится тобой! Это только начало.',
        msgAz: 'Bobo səninlə qürur duyur! Bu yalnız başlanğıcdır.',
        shareRu: 'Я учу язык с Söz Бобо — 3 дня подряд! 🔥',
        shareAz: 'Söz Bobo ilə dil öyrənirəm — 3 gün ardıcıl! 🔥' },
  5:  { icon: 'star', titleRu: '5 дней подряд!',  titleAz: '5 gün ardıcıl!',
        msgRu: 'Ты настоящий ученик! Бобо тебя обожает.',
        msgAz: 'Sən əsl tələbəsən! Bobo səni çox sevir.',
        shareRu: 'Я учу язык с Söz Бобо — 5 дней подряд! ⭐',
        shareAz: 'Söz Bobo ilə dil öyrənirəm — 5 gün ardıcıl! ⭐' },
  7:  { icon: 'trophy', titleRu: 'Неделя побед!',   titleAz: 'Qələbə həftəsi!',
        msgRu: 'Целая неделя! Это уже привычка чемпиона.',
        msgAz: 'Bütün bir həftə! Bu artıq çempion vərdişidir.',
        shareRu: 'Я учу язык с Söz Бобо — целая неделя! 🏆',
        shareAz: 'Söz Bobo ilə dil öyrənirəm — bütün həftə! 🏆' },
  14: { icon: 'gem', titleRu: '2 недели!',       titleAz: '2 həftə!',
        msgRu: 'Ты невероятный! Бобо считает тебя своим лучшим другом.',
        msgAz: 'Sən inanılmazsan! Bobo səni ən yaxşı dostu hesab edir.',
        shareRu: 'Я учу язык с Söz Бобо — 2 недели подряд! 💎',
        shareAz: 'Söz Bobo ilə dil öyrənirəm — 2 həftə ardıcıl! 💎' },
  30: { icon: 'crown', titleRu: 'МЕСЯЦ!',         titleAz: 'BİR AY!',
        msgRu: 'Ты — легенда. Целый месяц учёбы. Бобо салютует.',
        msgAz: 'Sən əfsanəsən. Bütöv bir ay təhsil. Bobo salam verir.',
        shareRu: 'Я учу язык с Söz Бобо — МЕСЯЦ! 👑',
        shareAz: 'Söz Bobo ilə dil öyrənirəm — BİR AY! 👑' },
};

function ConfettiPiece({ x, delay, color, size }: { x: number; delay: number; color: string; size: number }) {
  const y = useSharedValue(-30);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    y.value = withDelay(delay, withTiming(SH + 60, { duration: 3500 + Math.random() * 1500 }));
    rotate.value = withDelay(delay, withTiming(720 + Math.random() * 360, { duration: 4000 }));
    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(2500, withTiming(0, { duration: 800 })),
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { rotate: `${rotate.value}deg` }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { position: 'absolute', left: x, top: 0, width: size, height: size * 0.4, backgroundColor: color, borderRadius: 2 },
        style,
      ]}
      pointerEvents="none"
    />
  );
}

export default function MilestoneScreen() {
  const router = useRouter();
  const { streak } = useLocalSearchParams<{ streak: string; lang: string; day: string }>();
  const parentLang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const petName = useSettings((s) => s.petName);
  const isAz = parentLang === 'az';
  const { mode: uiMode, t, accent } = useTheme();
  const styles = stylesByMode[uiMode];
  const CONFETTI_COLORS = CONFETTI_COLORS_BY_MODE[uiMode];
  const insets = useSafeAreaInsets();

  const milestoneNum = Number(streak);
  const info = MILESTONES[milestoneNum] ?? MILESTONES[3]!;

  const numberScale = useSharedValue(0);
  const haloScale = useSharedValue(0.9);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    numberScale.value = withSequence(withTiming(1.2, { duration: 500 }), withSpring(1, { damping: 6 }));
    haloScale.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 1400 }), withTiming(0.94, { duration: 1400 })),
      -1,
      true,
    );
  }, [numberScale, haloScale]);

  const numberStyle = useAnimatedStyle(() => ({ transform: [{ scale: numberScale.value }] }));
  const haloStyle = useAnimatedStyle(() => ({ transform: [{ scale: haloScale.value }] }));

  const confetti = useMemo(
    () =>
      Array.from({ length: t.confetti + 16 }, (_, i) => ({
        id: i,
        x: Math.random() * SW,
        delay: i * 60 + Math.random() * 400,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
        size: 8 + Math.random() * 8,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleContinue = () => {
    Haptics.selectionAsync().catch(() => {});
    router.back(); // назад к «Урок выполнен» — там кнопки дальше
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: withCompanionName(isAz ? info.shareAz : info.shareRu, petName) });
    } catch { /* закрыли окно */ }
  };

  return (
    <PaperBackground>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {confetti.map((c) => (
          <ConfettiPiece key={c.id} x={c.x} delay={c.delay} color={c.color} size={c.size} />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing[8], paddingHorizontal: t.density.padX, gap: t.density.gap },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(500)} style={styles.center}>
          <HBIconBox icon={info.icon} tint={accent.soft} iconColor={accent.ink} size={56} />
          <Text variant="label" style={{ color: accent.ink }}>
            {isAz ? 'Günlük seriya' : 'Дней подряд'}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(600).delay(100)} style={styles.numberWrap}>
          <Animated.View style={[styles.halo, { backgroundColor: accent.soft, borderColor: accent.bottom }, haloStyle]} />
          <Animated.Text style={[styles.bigNumber, { color: accent.ink }, numberStyle]}>{milestoneNum}</Animated.Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(500)} style={styles.center}>
          <Text variant="title" align="center">
            {isAz ? info.titleAz : info.titleRu}
          </Text>
          <Text variant="body" tone="secondary" align="center" style={styles.subtitle}>
            {`${childName ? childName + '! ' : ''}${withCompanionName(isAz ? info.msgAz : info.msgRu, petName)}`}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(700)} style={styles.center}>
          <HBPet size={Math.round(t.mascot.hero * 0.75)} mood="happy" />
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(450).delay(900)} style={styles.buttons}>
          <HBButton full iconRight="arrow-right" label={isAz ? 'Davam et' : 'Продолжить'} onPress={handleContinue} />
          <HBButton full variant="soft" icon="share-2" label={isAz ? 'Paylaş' : 'Поделиться'} onPress={handleShare} />
        </Animated.View>
      </ScrollView>
    </PaperBackground>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  content: { paddingBottom: spacing[8], alignItems: 'stretch' },
  center: { alignItems: 'center', gap: spacing[2] },
  numberWrap: { alignSelf: 'center', width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 2 },
  bigNumber: {
    fontFamily: fontFamily.display,
    fontSize: scaleFont(110),
    lineHeight: scaleFont(130),
    letterSpacing: -4,
  },
  subtitle: { maxWidth: 320 },
  buttons: { gap: spacing[2], marginTop: spacing[2] },
}));
