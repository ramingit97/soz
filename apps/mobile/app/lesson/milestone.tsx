/**
 * Milestone celebration screen — appears when streak hits 3/5/7/14/30 days.
 * Standalone "wow moment" before the regular lesson complete screen.
 * Shareable via system share sheet (Phase 19 will add a designed card).
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Dimensions, Pressable, Share, StyleSheet, View } from 'react-native';
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

import { Bobo } from '@/components/Bobo';
import { Text } from '@/components/Text';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing } from '@/theme';
import { withCompanionName } from '@/utils/companion';

const { width: SW, height: SH } = Dimensions.get('window');

interface MilestoneInfo {
  emoji: string;
  bigEmoji: string;
  titleRu: string;
  titleAz: string;
  msgRu: string;
  msgAz: string;
  shareRu: string;
  shareAz: string;
  gradient: [string, string, string];
}

const MILESTONES: Record<number, MilestoneInfo> = {
  3:  { emoji: '🔥', bigEmoji: '🔥',  titleRu: '3 дня подряд!',  titleAz: '3 gün ardıcıl!',
        msgRu: 'Bobo гордится тобой! Это только начало.',
        msgAz: 'Bobo səninlə qürur duyur! Bu yalnız başlanğıcdır.',
        shareRu: 'Я учу язык с Söz Bobo — 3 дня подряд! 🔥',
        shareAz: 'Söz Bobo ilə dil öyrənirəm — 3 gün ardıcıl! 🔥',
        gradient: ['#FF6B35', '#F7931E', '#FFD24C'] },
  5:  { emoji: '⭐', bigEmoji: '⭐',  titleRu: '5 дней подряд!',  titleAz: '5 gün ardıcıl!',
        msgRu: 'Ты настоящий ученик! Bobo тебя обожает.',
        msgAz: 'Sən əsl tələbəsən! Bobo səni çox sevir.',
        shareRu: 'Я учу язык с Söz Bobo — 5 дней подряд! ⭐',
        shareAz: 'Söz Bobo ilə dil öyrənirəm — 5 gün ardıcıl! ⭐',
        gradient: ['#7C5CFF', '#A855F7', '#EC4899'] },
  7:  { emoji: '🏆', bigEmoji: '🏆',  titleRu: 'Неделя побед!',   titleAz: 'Qələbə həftəsi!',
        msgRu: 'Целая неделя! Это уже привычка чемпиона.',
        msgAz: 'Bütün bir həftə! Bu artıq çempion vərdişidir.',
        shareRu: 'Я учу язык с Söz Bobo — целая неделя! 🏆',
        shareAz: 'Söz Bobo ilə dil öyrənirəm — bütün həftə! 🏆',
        gradient: ['#059669', '#34D399', '#FBBF24'] },
  14: { emoji: '💎', bigEmoji: '💎',  titleRu: '2 недели!',       titleAz: '2 həftə!',
        msgRu: 'Ты невероятный! Bobo считает тебя своим лучшим другом.',
        msgAz: 'Sən inanılmazsan! Bobo səni ən yaxşı dostu hesab edir.',
        shareRu: 'Я учу язык с Söz Bobo — 2 недели подряд! 💎',
        shareAz: 'Söz Bobo ilə dil öyrənirəm — 2 həftə ardıcıl! 💎',
        gradient: ['#0EA5E9', '#06B6D4', '#A78BFA'] },
  30: { emoji: '👑', bigEmoji: '👑',  titleRu: 'МЕСЯЦ!',         titleAz: 'BİR AY!',
        msgRu: 'Ты — легенда. Целый месяц учёбы. Bobo салютует.',
        msgAz: 'Sən əfsanəsən. Bütöv bir ay təhsil. Bobo salam verir.',
        shareRu: 'Я учу язык с Söz Bobo — МЕСЯЦ! 👑',
        shareAz: 'Söz Bobo ilə dil öyrənirəm — BİR AY! 👑',
        gradient: ['#DC2626', '#F59E0B', '#FCD34D'] },
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
  const { streak, lang = 'en', day = '1' } = useLocalSearchParams<{ streak: string; lang: string; day: string }>();
  const parentLang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const petName = useSettings((s) => s.petName);
  const isAz = parentLang === 'az';

  const milestoneNum = Number(streak);
  const info = MILESTONES[milestoneNum] ?? MILESTONES[3]!;

  // Big emoji bounce
  const emojiScale = useSharedValue(0);
  const emojiRotate = useSharedValue(-30);

  // Halo pulse
  const haloScale = useSharedValue(0.85);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    emojiScale.value = withSequence(
      withTiming(1.3, { duration: 600 }),
      withSpring(1, { damping: 6 }),
    );
    emojiRotate.value = withSpring(0, { damping: 5 });

    haloScale.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 1400 }), withTiming(0.92, { duration: 1400 })),
      -1,
      true,
    );
  }, []);

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }, { rotate: `${emojiRotate.value}deg` }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.value }],
  }));

  const confetti = useMemo(
    () => Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * SW,
      delay: i * 60 + Math.random() * 400,
      color: ['#FFD24C', '#7C5CFF', '#34D399', '#F87171', '#60A5FA', '#F472B6'][i % 6]!,
      size: 8 + Math.random() * 8,
    })),
    [],
  );

  const handleContinue = () => {
    Haptics.selectionAsync().catch(() => {});
    router.back(); // return to lesson/complete which still has its CTA buttons
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: withCompanionName(isAz ? info.shareAz : info.shareRu, petName),
      });
    } catch { /* user dismissed */ }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={info.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Confetti layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {confetti.map((c) => (
          <ConfettiPiece key={c.id} x={c.x} delay={c.delay} color={c.color} size={c.size} />
        ))}
      </View>

      <View style={styles.content}>
        {/* Streak counter */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.streakLabel}>
          <Text style={styles.streakLabelText}>
            {isAz ? 'GÜN STREAK' : 'СТРИК В ДНЯХ'}
          </Text>
        </Animated.View>

        {/* Big number */}
        <Animated.View entering={FadeIn.duration(800).delay(100)} style={styles.numberWrap}>
          <Animated.View style={[styles.halo, haloStyle]} />
          <Text style={styles.bigNumber}>{milestoneNum}</Text>
        </Animated.View>

        {/* Big emoji */}
        <Animated.View style={[styles.emojiWrap, emojiStyle]}>
          <Text style={styles.bigEmoji}>{info.bigEmoji}</Text>
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInUp.duration(500).delay(700)} style={styles.titleArea}>
          <Text style={styles.title}>{isAz ? info.titleAz : info.titleRu}</Text>
          <Text style={styles.subtitle}>
            {isAz
              ? `${childName ? childName + ', ' : ''}${withCompanionName(info.msgAz, petName)}`
              : `${childName ? childName + ', ' : ''}${withCompanionName(info.msgRu, petName)}`}
          </Text>
        </Animated.View>

        {/* Bobo */}
        <Animated.View entering={FadeInUp.duration(600).delay(900)} style={styles.boboArea}>
          <Bobo size={80} mood="happy" />
        </Animated.View>

        {/* Buttons */}
        <Animated.View entering={FadeInUp.duration(500).delay(1100)} style={styles.buttons}>
          <Pressable style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>
              {isAz ? '📤 Paylaş' : '📤 Поделиться'}
            </Text>
          </Pressable>
          <Pressable style={styles.continueBtn} onPress={handleContinue}>
            <Text style={styles.continueBtnText}>
              {isAz ? 'Davam et →' : 'Продолжить →'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[10],
    gap: spacing[3],
  },

  streakLabel: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  streakLabelText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['2xs'],
    letterSpacing: 2,
  },

  numberWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -spacing[4],
  },
  halo: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  bigNumber: {
    color: colors.white,
    fontFamily: fontFamily.display,
    fontSize: scaleFont(160),
    lineHeight: 180,
    letterSpacing: -6,
  },

  emojiWrap: {
    position: 'absolute',
    top: '38%',
    right: '20%',
  },
  bigEmoji: {
    fontSize: scaleFont(64),
  },

  titleArea: {
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    color: colors.white,
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'],
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 22,
  },

  boboArea: {
    marginTop: spacing[2],
  },

  buttons: {
    width: '100%',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  shareBtn: {
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  shareBtnText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
  },
  continueBtn: {
    paddingVertical: spacing[4],
    alignItems: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.white,
    ...shadow.lg,
  },
  continueBtnText: {
    color: colors.ink,
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.lg,
    letterSpacing: 0.3,
  },
});
