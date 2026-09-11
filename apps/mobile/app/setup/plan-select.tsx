/**
 * Post-onboarding plan selection: free trial / Premium / continue free.
 *
 * Trial & Premium route to the full paywall (RevenueCat handles the actual
 * purchase + intro offer; in Expo Go it shows gracefully with no offerings).
 * "Continue free" goes straight home — days 1–FREE_DAYS are free for everyone.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { FREE_DAYS } from '@/services/subscriptions';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing } from '@/theme';

export default function PlanSelectScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const petHue = useSettings((s) => s.petHue);
  const isAz = lang === 'az';

  const goPaywall = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/paywall' as any);
  };
  const goFree = () => {
    Haptics.selectionAsync().catch(() => {});
    // Fresh onboarding chain (register → notify → plan-select): show the
    // AI-plan build progress before landing home.
    router.replace('/setup/building' as any);
  };

  return (
    <PaperBackground>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <HBPet size={92} hue={petHue} mood="happy" />
          <Text style={styles.title}>{isAz ? 'Planı seç' : 'Выбери план'}</Text>
          <Text style={styles.sub}>{isAz ? 'İstənilən vaxt dəyişmək olar' : 'Можно изменить в любой момент'}</Text>
        </Animated.View>

        {/* Trial — recommended */}
        <Animated.View entering={FadeInUp.duration(450).delay(120)}>
          <Pressable onPress={goPaywall} style={[styles.hero, shadow.md]}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{isAz ? 'TÖVSİYƏ' : 'СОВЕТУЕМ'}</Text>
            </View>
            <Text style={styles.heroEmoji}>🎁</Text>
            <Text style={styles.heroTitle}>{isAz ? '7 gün pulsuz' : '7 дней бесплатно'}</Text>
            <Text style={styles.heroSub}>
              {isAz
                ? 'Tam giriş · indi $0 · istənilən vaxt ləğv'
                : 'Полный доступ · $0 сейчас · отмена в любой момент'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Premium */}
        <Animated.View entering={FadeInUp.duration(450).delay(200)}>
          <Pressable onPress={goPaywall} style={[styles.card, shadow.sm]}>
            <Text style={styles.cardEmoji}>⭐</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Premium</Text>
              <Text style={styles.cardSub}>
                {isAz ? 'İki dil · bütün dərslər · ailə üçün' : 'Два языка · все уроки · для всей семьи'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Animated.View>

        {/* Free */}
        <Animated.View entering={FadeInUp.duration(450).delay(280)}>
          <Pressable onPress={goFree} style={[styles.card, shadow.sm]}>
            <Text style={styles.cardEmoji}>🆓</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{isAz ? 'Pulsuz davam et' : 'Продолжить бесплатно'}</Text>
              <Text style={styles.cardSub}>
                {isAz ? `İlk ${FREE_DAYS} gün pulsuz` : `Первые ${FREE_DAYS} дней бесплатно`}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Animated.View>

        <Pressable onPress={goFree} style={styles.skip} hitSlop={8}>
          <Text style={styles.skipText}>{isAz ? 'Sonra qərar verərəm' : 'Решу позже'}</Text>
        </Pressable>
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[6], paddingTop: 64, paddingBottom: spacing[10], gap: spacing[3] },
  header: { alignItems: 'center', gap: spacing[2], marginBottom: spacing[4] },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'],
    color: colors.ink,
    letterSpacing: -0.5,
    marginTop: spacing[2],
  },
  sub: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.inkSoft },

  hero: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius['2xl'],
    padding: spacing[5],
    alignItems: 'center',
    gap: spacing[1],
    borderWidth: 2,
    borderColor: colors.primary,
  },
  badge: {
    position: 'absolute',
    top: -10,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[3],
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  badgeText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize['3xs'], color: colors.white, letterSpacing: 1 },
  heroEmoji: { fontSize: 40, marginTop: spacing[2] },
  heroTitle: { fontFamily: fontFamily.display, fontSize: fontSize['2xl'], color: colors.primaryDeep },
  heroSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing[4],
  },
  cardEmoji: { fontSize: 28 },
  cardTitle: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.base, color: colors.ink },
  cardSub: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.caption, color: colors.inkSoft, marginTop: 2 },
  chevron: { fontFamily: fontFamily.bodyBlack, fontSize: scaleFont(26), color: colors.inkSoft },

  skip: { alignSelf: 'center', paddingVertical: spacing[4] },
  skipText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.inkSoft },
});
