/**
 * Honeybear · Paywall (Söz Premium).
 *
 * Хани wears a crown, sparkles around, peach radial halo on cream paper.
 * Features card uses dashed dividers; testimonials in butter-tinted cards
 * with a left berry rule. Plan toggle has the year card painted primary with
 * a savings badge whose percentage is computed from the real prices.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import Svg, { Path, Circle } from 'react-native-svg';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { track } from '@/services/analytics';
import {
  FREE_DAYS,
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '@/services/subscriptions';
import { getBillingStatus } from '@/services/api';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing, tints } from '@/theme';
import { useCompanionName, withCompanionName } from '@/utils/companion';

const PREMIUM_DAYS = 30 - FREE_DAYS;

const FEATURES = [
  {
    emoji: '🧠',
    titleRu: 'Bobo помнит вашего ребёнка',
    titleAz: 'Bobo uşağınızı xatırlayır',
    subRu: 'Имя кота, любимый цвет, школа — Bobo запоминает каждый разговор',
    subAz: 'Pişiyin adı, sevimli rəng, məktəb — Bobo hər söhbəti yadda saxlayır',
  },
  {
    emoji: '✨',
    titleRu: 'AI создаёт план под ребёнка',
    titleAz: 'AI uşağa uyğun plan qurur',
    subRu: 'После 30 дней AI анализирует ошибки и составляет персональные уроки',
    subAz: '30 gündən sonra AI səhvləri təhlil edib fərdi dərslər tərtib edir',
  },
  {
    emoji: '📚',
    titleRu: `Все 30 дней + бесконечный AI-курс`,
    titleAz: `Bütün 30 gün + sonsuz AI kursu`,
    subRu: `+${PREMIUM_DAYS} уроков сейчас, и новые уроки каждую неделю после`,
    subAz: `İndi +${PREMIUM_DAYS} dərs, sonra hər həftə yeni dərslər`,
  },
  {
    emoji: '🗣️',
    titleRu: 'Безлимитные разговоры с Bobo',
    titleAz: 'Bobo ilə limitsiz söhbət',
    subRu: 'Свободная практика речи в любое время дня',
    subAz: 'İstənilən vaxtda sərbəst nitq təcrübəsi',
  },
  {
    emoji: '📊',
    titleRu: 'Глубокая аналитика для родителя',
    titleAz: 'Valideyn üçün dərin analiz',
    subRu: 'Сильные стороны, слабые места, рекомендации',
    subAz: 'Güclü tərəflər, zəif yerlər, tövsiyələr',
  },
];

const TESTIMONIALS = [
  {
    quoteRu: 'Мой Самир уже сам открывает приложение каждый вечер. Bobo стал его другом!',
    quoteAz: 'Səmirim hər axşam özü tətbiqi açır. Bobo onun dostu oldu!',
    nameRu: 'Лейла, мама Самира (7 лет)',
    nameAz: 'Leyla, Səmirin anası (7 yaş)',
  },
  {
    quoteRu: 'За месяц дочь начала говорить простыми фразами на английском. Невероятно.',
    quoteAz: 'Bir ayda qızım sadə cümlələrlə ingiliscə danışmağa başladı. İnanılmazdır.',
    nameRu: 'Эльдар, отец Айсель (9 лет)',
    nameAz: 'Eldar, Aysəlin atası (9 yaş)',
  },
];

function Crown() {
  return (
    <Svg width="64" height="34" viewBox="0 0 62 32">
      <Path
        d="M 6 26 L 8 8 L 18 18 L 31 4 L 44 18 L 54 8 L 56 26 Z"
        fill={colors.butter}
        stroke={colors.ink}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Circle cx="18" cy="18" r="2.5" fill={colors.berry} />
      <Circle cx="31" cy="14" r="3" fill={colors.berry} />
      <Circle cx="44" cy="18" r="2.5" fill={colors.berry} />
    </Svg>
  );
}

/** A sparkle that gently twinkles (opacity + scale) rather than sitting static —
 * the paywall is the one screen that earns a little shimmer. Respects reduced motion. */
function TwinkleStar({ x, y, color, size, delay }: {
  x: number; y: number; color: string; size: number; delay: number;
}) {
  const reduced = useReducedMotion();
  const op = useSharedValue(reduced ? 1 : 0.35);
  const sc = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    op.value = withDelay(delay, withRepeat(
      withSequence(withTiming(1, { duration: 900 }), withTiming(0.35, { duration: 900 })),
      -1, true,
    ));
    sc.value = withDelay(delay, withRepeat(
      withSequence(withTiming(1.25, { duration: 900 }), withTiming(0.85, { duration: 900 })),
      -1, true,
    ));
  }, [reduced]);
  const style = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scale: sc.value }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y }, style]}>
      <Text style={{ fontSize: size, color }}>✦</Text>
    </Animated.View>
  );
}

export default function PaywallScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const bot = useCompanionName();
  const setIsPremium = useSettings((s) => s.setIsPremium);
  const petName = useSettings((s) => s.petName);
  const isAz = lang === 'az';

  const userId = useSettings((s) => s.userId);
  const childId = useSettings((s) => s.childId);

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [selectedPkg, setSelectedPkg] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    track({ event: 'paywall_viewed', userId, childId });
    getOfferings().then((o) => {
      const current = o?.current ?? null;
      setOffering(current);
      const annual = current?.annual ?? current?.availablePackages[0] ?? null;
      setSelectedPkg(annual);
      setLoading(false);
    });
  }, []);

  /**
   * Reconcile the local flag with the server's entitlement, retrying briefly
   * because the RevenueCat webhook is asynchronous — the purchase returns before
   * users.premium_until is necessarily written.
   */
  const syncServerEntitlement = async () => {
    const token = useSettings.getState().authToken;
    if (!token) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { isPremium: serverPremium } = await getBillingStatus(token);
        if (serverPremium) {
          setIsPremium(true);
          return;
        }
      } catch {
        /* offline — keep the optimistic local flag; app_open re-checks */
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
  };

  const handlePurchase = async () => {
    if (!selectedPkg) return;
    setPurchasing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    track({ event: 'purchase_initiated', userId, childId, props: { packageId: selectedPkg.identifier } });
    const success = await purchasePackage(selectedPkg);
    if (success) {
      setIsPremium(true);
      // RevenueCat's webhook writes users.premium_until, which is what the API
      // actually gates on. It usually lands within a second, but unlocking the
      // UI on the SDK's word alone would show content the server still refuses.
      // Re-read the server's view so the two agree before leaving the screen.
      await syncServerEntitlement();
      track({ event: 'purchase_success', userId, childId, props: { packageId: selectedPkg.identifier } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/home');
    } else {
      track({ event: 'purchase_failed', userId, childId });
    }
    setPurchasing(false);
  };

  const handleRestore = async () => {
    setRestoring(true);
    const success = await restorePurchases();
    if (success) {
      setIsPremium(true);
      await syncServerEntitlement();
      track({ event: 'restore_success', userId, childId });
      router.replace('/home');
    }
    setRestoring(false);
  };

  const annualPkg = offering?.annual ?? null;
  const monthlyPkg = offering?.monthly ?? null;

  function priceStr(pkg: PurchasesPackage | null): string {
    if (!pkg) return '—';
    return pkg.product.priceString;
  }

  function annualMonthlyPrice(pkg: PurchasesPackage | null): string {
    if (!pkg) return '';
    const annual = pkg.product.price;
    const perMonth = (annual / 12).toFixed(2);
    return `${pkg.product.currencyCode} ${perMonth}/${isAz ? 'ay' : 'мес'}`;
  }

  /**
   * Скидка годового тарифа, посчитанная из ЦЕН, которые реально пришли из
   * RevenueCat. Раньше здесь стояло «-40%» текстом в разметке, и это разошлось
   * с действительностью в тот же день, когда цены поменяли на $13/$99.99
   * (настоящая скидка — 36%). Завышенная выгода рядом с ценой — это
   * недостоверное утверждение о цене: и обман родителя, и нарушение правил
   * Google Play. Считаем, чтобы разойтись было нельзя.
   *
   * null — когда одного из тарифов нет или цифры не дают внятной скидки;
   * тогда бейдж просто не рисуется.
   */
  function annualSavingsPercent(
    annual: PurchasesPackage | null,
    monthly: PurchasesPackage | null,
  ): number | null {
    if (!annual || !monthly) return null;
    const yearAtMonthlyRate = monthly.product.price * 12;
    if (yearAtMonthlyRate <= 0) return null;
    const saved = Math.round((1 - annual.product.price / yearAtMonthlyRate) * 100);
    return saved >= 5 ? saved : null;
  }

  return (
    <PaperBackground variant="honey">
      <Pressable onPress={() => router.back()} style={[styles.closeBtn, shadow.sm]}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero — Хани with crown */}
        <Animated.View entering={FadeInDown.duration(700)} style={styles.hero}>
          {/* sparkles — gently twinkling */}
          {[
            { x: -8, y: -4, c: colors.butter, s: 16 },
            { x: 130, y: 18, c: colors.berry, s: 14 },
            { x: -12, y: 90, c: colors.accent, s: 12 },
            { x: 140, y: 110, c: colors.primary, s: 10 },
          ].map((sp, i) => (
            <TwinkleStar key={i} x={sp.x} y={sp.y} color={sp.c} size={sp.s} delay={i * 220} />
          ))}

          <View style={styles.haloRing}>
            <View style={styles.petCenter}>
              <HBPet size={120} mood="happy" />
              <View style={styles.crownWrap}>
                <Crown />
              </View>
            </View>
          </View>

          <View style={styles.premiumBadge}>
            <Text style={styles.premiumBadgeText}>👑 PREMIUM</Text>
          </View>

          <Text style={styles.heroTitle}>
            {isAz ? 'Söz Premium' : 'Söz Премиум'}
          </Text>
          <Text style={styles.heroSub}>
            {isAz
              ? `Bütün ${PREMIUM_DAYS} günü aç və nəticəyə çat`
              : `Открой все 30 дней и достигни цели`}
          </Text>
        </Animated.View>

        {/* Features */}
        <Animated.View entering={FadeInUp.duration(500).delay(200)} style={{ width: '100%' }}>
          <HBCard depth="md" style={{ paddingVertical: spacing[2] }}>
            {FEATURES.map((f, i) => (
              <View
                key={i}
                style={[
                  styles.featureRow,
                  i > 0 && styles.featureRowDashed,
                ]}
              >
                <View style={styles.featureEmoji}>
                  <Text style={{ fontSize: 22 }}>{f.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>
                    {withCompanionName(isAz ? f.titleAz : f.titleRu, petName)}
                  </Text>
                  <Text style={styles.featureSub}>
                    {withCompanionName(isAz ? f.subAz : f.subRu, petName)}
                  </Text>
                </View>
                <Text style={{ color: colors.accent, fontSize: 18, fontFamily: fontFamily.bodyBlack }}>✓</Text>
              </View>
            ))}
          </HBCard>
        </Animated.View>

        {/* Free vs Premium comparison — honest side-by-side */}
        <Animated.View entering={FadeInUp.duration(500).delay(240)} style={{ width: '100%' }}>
          <HBCard depth="sm" style={styles.compareCard}>
            <View style={styles.compareRow}>
              <View style={{ flex: 1 }} />
              <Text style={styles.compareColHead}>{isAz ? 'Pulsuz' : 'Бесплатно'}</Text>
              <Text style={[styles.compareColHead, styles.compareColHeadPrem]}>Premium</Text>
            </View>
            {[
              { l: isAz ? 'Kurs günləri' : 'Дни курса', free: `${FREE_DAYS}`, prem: isAz ? 'Hamısı + AI' : 'Все + AI' },
              { l: isAz ? `${bot} ilə söhbət` : `Разговоры с ${bot}`, free: isAz ? 'Məhdud' : 'Лимит', prem: '∞' },
              { l: isAz ? 'Yaddaş' : 'Память', free: isAz ? 'Əsas' : 'База', prem: isAz ? 'Tam' : 'Полная' },
              { l: isAz ? 'Valideyn hesabatı' : 'Отчёты родителю', free: '—', prem: '✓' },
            ].map((r, i) => (
              <View key={i} style={[styles.compareRow, styles.compareRowBorder]}>
                <Text style={styles.compareLabel}>{r.l}</Text>
                <Text style={styles.compareFree}>{r.free}</Text>
                <View style={styles.comparePremCell}>
                  <Text style={styles.comparePremText}>{r.prem}</Text>
                </View>
              </View>
            ))}
          </HBCard>
        </Animated.View>

        {/* Testimonials */}
        <Animated.View entering={FadeInUp.duration(500).delay(280)} style={styles.testimonialsBlock}>
          <Text style={styles.testimonialsLabel}>
            {isAz ? 'VALIDEYNLƏR DEYIR' : 'РОДИТЕЛИ ГОВОРЯТ'}
          </Text>
          {TESTIMONIALS.map((t, i) => (
            <HBCard
              key={i}
              depth="sm"
              bg={tints.butter}
              style={styles.testimonialCard}
            >
              <Text style={styles.testimonialQuote}>
                «{withCompanionName(isAz ? t.quoteAz : t.quoteRu, petName)}»
              </Text>
              <Text style={styles.testimonialName}>
                — {isAz ? t.nameAz : t.nameRu}
              </Text>
            </HBCard>
          ))}
        </Animated.View>

        {/* Packages */}
        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: spacing[6] }} />
        ) : (
          <Animated.View entering={FadeInUp.duration(500).delay(350)} style={styles.packages}>
            {annualPkg && (
              <Pressable
                onPress={() => setSelectedPkg(annualPkg)}
                style={({ pressed }) => [pressed && { opacity: 0.85 }]}
              >
                <HBCard
                  depth={selectedPkg === annualPkg ? 'deep' : 'sm'}
                  ringColor={selectedPkg === annualPkg ? colors.primary : undefined}
                  bg={selectedPkg === annualPkg ? colors.primary : undefined}
                  style={styles.packageCard}
                >
                  {(() => {
                    const saved = annualSavingsPercent(annualPkg, monthlyPkg);
                    if (saved === null) return null;
                    return (
                      <View style={styles.bestValueBadge}>
                        <Text style={styles.bestValueText}>
                          {isAz ? `ƏN YAXŞI · -${saved}%` : `ВЫГОДНЕЕ -${saved}%`}
                        </Text>
                      </View>
                    );
                  })()}
                  <View style={styles.packageRow}>
                    <View>
                      <Text style={[styles.packagePeriod, selectedPkg === annualPkg && { color: colors.white }]}>
                        {isAz ? 'İllik' : 'Годовой'}
                      </Text>
                      <Text style={[styles.packageMonthly, selectedPkg === annualPkg && { color: 'rgba(255,255,255,0.85)' }]}>
                        {annualMonthlyPrice(annualPkg)}
                      </Text>
                    </View>
                    <Text style={[styles.packagePrice, selectedPkg === annualPkg && { color: colors.white }]}>
                      {priceStr(annualPkg)}
                    </Text>
                  </View>
                  {selectedPkg === annualPkg && (
                    <View style={styles.checkCircle}>
                      <Text style={{ fontSize: fontSize.xs, color: colors.primary, fontFamily: fontFamily.bodyBlack }}>✓</Text>
                    </View>
                  )}
                </HBCard>
              </Pressable>
            )}

            {monthlyPkg && (
              <Pressable
                onPress={() => setSelectedPkg(monthlyPkg)}
                style={({ pressed }) => [pressed && { opacity: 0.85 }]}
              >
                <HBCard
                  depth={selectedPkg === monthlyPkg ? 'deep' : 'sm'}
                  ringColor={selectedPkg === monthlyPkg ? colors.primary : undefined}
                  style={styles.packageCard}
                >
                  <View style={styles.packageRow}>
                    <Text style={styles.packagePeriod}>
                      {isAz ? 'Aylıq' : 'Ежемесячно'}
                    </Text>
                    <Text style={styles.packagePrice}>{priceStr(monthlyPkg)}</Text>
                  </View>
                </HBCard>
              </Pressable>
            )}

            {!annualPkg && !monthlyPkg && (
              <HBCard style={styles.noOfferingsBox} depth="sm">
                <Text style={styles.noOfferingsText}>
                  {isAz
                    ? 'Abunəlik məlumatları yüklənə bilmədi. Yenidən cəhd edin.'
                    : 'Не удалось загрузить тарифы. Попробуйте позже.'}
                </Text>
              </HBCard>
            )}
          </Animated.View>
        )}

        {/* CTA */}
        <Animated.View entering={FadeInUp.duration(500).delay(500)} style={styles.ctaSection}>
          <HBButton
            full
            variant={selectedPkg ? 'primary' : 'soft'}
            label={
              purchasing
                ? isAz ? 'Alınır...' : 'Покупка...'
                : isAz ? '🚀 7 gün pulsuz cəhd et' : '🚀 Попробовать 7 дней бесплатно'
            }
            onPress={handlePurchase}
            disabled={purchasing || !selectedPkg}
          />

          <Pressable onPress={handleRestore} disabled={restoring} style={styles.restoreBtn}>
            <Text style={styles.restoreText}>
              {restoring
                ? (isAz ? 'Bərpa olunur...' : 'Восстановление...')
                : (isAz ? 'Satın almaları bərpa et' : 'Восстановить покупки')}
            </Text>
          </Pressable>

          <Text style={styles.legalText}>
            {isAz
              ? 'Abunəlik avtomatik olaraq yenilənəcək. İstənilən vaxt ləğv etmək olar.'
              : 'Авто-продление можно отменить в любой момент.'}
          </Text>
        </Animated.View>
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: spacing[5],
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: colors.ink, fontSize: fontSize.sm, fontFamily: fontFamily.bodyBlack },

  scroll: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[12],
    paddingTop: 64,
    gap: spacing[4],
  },

  hero: { alignItems: 'center', gap: spacing[2] },
  haloRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(245, 212, 102, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  petCenter: {
    position: 'relative',
    alignItems: 'center',
  },
  crownWrap: {
    position: 'absolute',
    top: -22,
    alignSelf: 'center',
  },
  premiumBadge: {
    backgroundColor: colors.ink,
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
    borderRadius: radius.full,
    marginTop: spacing[2],
  },
  premiumBadgeText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['2xs'],
    letterSpacing: 1.5,
  },
  heroTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'],
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing[1],
  },
  heroSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },

  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  featureRowDashed: {
    borderTopWidth: 1,
    borderTopColor: colors.bgDeep,
    borderStyle: 'dashed',
  },
  featureEmoji: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.sm,
    color: colors.ink,
    lineHeight: 18,
  },
  featureSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['2xs'],
    color: colors.inkSoft,
    marginTop: 2,
    lineHeight: 15,
  },

  testimonialsBlock: { gap: spacing[2] },
  testimonialsLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['3xs'],
    color: colors.inkSoft,
    letterSpacing: 1.8,
    marginBottom: spacing[1],
    marginLeft: spacing[1],
  },
  testimonialCard: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderLeftWidth: 3,
    borderLeftColor: colors.berry,
  },
  testimonialQuote: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.ink,
    lineHeight: 21,
    fontStyle: 'italic',
  },
  testimonialName: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: spacing[1],
  },

  compareCard: { paddingVertical: spacing[2] },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  compareRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.bgDeep,
    borderStyle: 'dashed',
  },
  compareColHead: {
    width: 72,
    textAlign: 'center',
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['3xs'],
    letterSpacing: 0.8,
    color: colors.inkSoft,
  },
  compareColHeadPrem: { color: colors.primary },
  compareLabel: {
    flex: 1,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  compareFree: {
    width: 72,
    textAlign: 'center',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  comparePremCell: {
    width: 72,
    alignItems: 'center',
  },
  comparePremText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.sm,
    color: colors.primaryDeep,
  },

  packages: { gap: spacing[2] },
  packageCard: {
    position: 'relative',
    paddingVertical: spacing[3],
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: spacing[4],
    backgroundColor: colors.berry,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  bestValueText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: scaleFont(9),
    color: colors.white,
    letterSpacing: 0.5,
  },
  packageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packagePeriod: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  packageMonthly: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['2xs'],
    color: colors.inkSoft,
    marginTop: 2,
  },
  packagePrice: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  checkCircle: {
    position: 'absolute',
    bottom: spacing[2],
    right: spacing[2],
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noOfferingsBox: { padding: spacing[5] },
  noOfferingsText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
  },

  ctaSection: { gap: spacing[2], marginTop: spacing[3] },
  restoreBtn: { paddingVertical: spacing[2], alignItems: 'center' },
  restoreText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
  legalText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize['3xs'],
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: spacing[4],
  },
});
