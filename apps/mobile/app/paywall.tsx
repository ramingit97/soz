/**
 * Пейволл Söz Premium — читает родитель, поэтому всегда «взрослый» режим.
 *
 * Персонаж в короне, что даёт Premium, честное сравнение с бесплатным, тарифы
 * (скидка годового считается из настоящих цен RevenueCat), покупка,
 * восстановление и условия продления.
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
import { HBIconBox } from '@/components/HBIconBox';
import { HBPet } from '@/components/HBPet';
import { Icon, type IconName } from '@/components/Icon';
import { InlineBanner } from '@/components/InlineBanner';
import { PaperBackground } from '@/components/PaperBackground';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { UIModeProvider } from '@/hooks/useUIMode';
import { track } from '@/services/analytics';
import {
  FREE_DAYS,
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '@/services/subscriptions';
import { getBillingStatus } from '@/services/api';
import { useSettings } from '@/store/settings';
import { fontFamily, fontSize, radius, spacing } from '@/theme';
import { MODE_TOKENS, makeModeStyles } from '@/theme/modeTokens';
import { useCompanionName, withCompanionName } from '@/utils/companion';
import { useTheme } from '@/hooks/useTheme';

const PREMIUM_DAYS = 30 - FREE_DAYS;

const FEATURES = [
  {
    icon: 'brain' as IconName,
    titleRu: 'Бобо помнит вашего ребёнка',
    titleAz: 'Bobo uşağınızı xatırlayır',
    subRu: 'Имя кота, любимый цвет, школа — Бобо запоминает каждый разговор',
    subAz: 'Pişiyin adı, sevimli rəng, məktəb — Bobo hər söhbəti yadda saxlayır',
  },
  {
    icon: 'sparkles' as IconName,
    titleRu: 'AI создаёт план под ребёнка',
    titleAz: 'AI uşağa uyğun plan qurur',
    subRu: 'После 30 дней AI анализирует ошибки и составляет персональные уроки',
    subAz: '30 gündən sonra AI səhvləri təhlil edib fərdi dərslər tərtib edir',
  },
  {
    icon: 'library' as IconName,
    titleRu: `Все 30 дней + бесконечный AI-курс`,
    titleAz: `Bütün 30 gün + sonsuz AI kursu`,
    subRu: `+${PREMIUM_DAYS} уроков сейчас, и новые уроки каждую неделю после`,
    subAz: `İndi +${PREMIUM_DAYS} dərs, sonra hər həftə yeni dərslər`,
  },
  {
    icon: 'mic' as IconName,
    titleRu: 'Безлимитные разговоры с Бобо',
    titleAz: 'Bobo ilə limitsiz söhbət',
    subRu: 'Свободная практика речи в любое время дня',
    subAz: 'İstənilən vaxtda sərbəst nitq təcrübəsi',
  },
  {
    icon: 'chart-column' as IconName,
    titleRu: 'Глубокая аналитика для родителя',
    titleAz: 'Valideyn üçün dərin analiz',
    subRu: 'Сильные стороны, слабые места, рекомендации',
    subAz: 'Güclü tərəflər, zəif yerlər, tövsiyələr',
  },
];

// Отзывы родителей были выдуманы (приложение ещё не вышло): такие отзывы вводят
// в заблуждение и запрещены правилами Google Play. Вернуть, когда будут настоящие.

function Crown() {
  const { c: palette } = useTheme();
  return (
    <Svg width="64" height="34" viewBox="0 0 62 32">
      <Path
        d="M 6 26 L 8 8 L 18 18 L 31 4 L 44 18 L 54 8 L 56 26 Z"
        fill={palette.butter}
        stroke={palette.ink}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Circle cx="18" cy="18" r="2.5" fill={palette.berry} />
      <Circle cx="31" cy="14" r="3" fill={palette.berry} />
      <Circle cx="44" cy="18" r="2.5" fill={palette.berry} />
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
  const { c: palette, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const bot = useCompanionName();
  const setIsPremium = useSettings((s) => s.setIsPremium);
  const petName = useSettings((s) => s.petName);
  const isAz = lang === 'az';
  const accent = useAccent();
  // Экран лежит вне своего UIModeProvider — отступы из взрослых токенов напрямую.
  const padX = MODE_TOKENS.teen.density.padX;

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

  const selectedAnnual = !!annualPkg && selectedPkg === annualPkg;
  const selectedMonthly = !!monthlyPkg && selectedPkg === monthlyPkg;
  const saved = annualSavingsPercent(annualPkg, monthlyPkg);

  return (
    // Пейволл читает родитель — всегда «взрослый» режим.
    <UIModeProvider force="teen">
      <PaperBackground>
        <ScreenHeader backIcon="x" backLabel={isAz ? 'Bağla' : 'Закрыть'} onBack={() => router.back()} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingHorizontal: padX }]}>
          {/* Персонаж в короне */}
          <Animated.View entering={FadeInDown.duration(600)} style={styles.hero}>
            {[
              { x: -8, y: -4, c: palette.butter, s: 16 },
              { x: 130, y: 18, c: palette.berry, s: 14 },
              { x: -12, y: 90, c: palette.accent, s: 12 },
              { x: 140, y: 110, c: palette.primary, s: 10 },
            ].map((sp, i) => (
              <TwinkleStar key={i} x={sp.x} y={sp.y} color={sp.c} size={sp.s} delay={i * 220} />
            ))}
            <View style={[styles.halo, { backgroundColor: accent.soft }]}>
              <HBPet size={110} mood="happy" />
              <View style={styles.crownWrap}>
                <Crown />
              </View>
            </View>
            <View style={[styles.premiumChip, { backgroundColor: palette.tints.butter }]}>
              <Icon name="crown" size={14} color="#7F6628" fill={palette.butter} strokeWidth={2} />
              <Text style={styles.premiumChipText}>PREMIUM</Text>
            </View>
            <Text variant="title" align="center">Söz Premium</Text>
            <Text variant="body" tone="secondary" align="center">
              {isAz ? 'Bütün 30 günü aç və nəticəyə çat' : 'Открой все 30 дней и дойди до результата'}
            </Text>
          </Animated.View>

          {/* Что даёт */}
          <Animated.View entering={FadeInUp.duration(450).delay(150)}>
            <HBCard style={styles.features}>
              {FEATURES.map((f, i) => (
                <View key={i} style={[styles.featureRow, i > 0 && styles.featureRule]}>
                  <HBIconBox icon={f.icon} tint={accent.soft} iconColor={accent.ink} size={40} />
                  <View style={styles.flex}>
                    <Text variant="bodyBold">{withCompanionName(isAz ? f.titleAz : f.titleRu, petName)}</Text>
                    <Text variant="caption" tone="secondary">
                      {withCompanionName(isAz ? f.subAz : f.subRu, petName)}
                    </Text>
                  </View>
                </View>
              ))}
            </HBCard>
          </Animated.View>

          {/* Бесплатно и Premium рядом — честно */}
          <Animated.View entering={FadeInUp.duration(450).delay(200)}>
            <HBCard style={styles.compare}>
              <View style={styles.compareRow}>
                <View style={styles.flex} />
                <Text variant="caption" tone="secondary" style={styles.compareCol}>
                  {isAz ? 'Pulsuz' : 'Бесплатно'}
                </Text>
                <Text variant="caption" style={[styles.compareCol, { color: accent.ink }]}>Premium</Text>
              </View>
              {[
                { l: isAz ? 'Kurs günləri' : 'Дни курса', free: `${FREE_DAYS}`, prem: isAz ? 'Hamısı + AI' : 'Все + AI' },
                { l: isAz ? `${bot} ilə söhbət` : `Разговоры с ${bot}`, free: isAz ? 'Məhdud' : 'Лимит', prem: isAz ? 'Limitsiz' : 'Без лимита' },
                { l: isAz ? 'Yaddaş' : 'Память', free: isAz ? 'Əsas' : 'База', prem: isAz ? 'Tam' : 'Полная' },
                { l: isAz ? 'Valideyn hesabatı' : 'Отчёты родителю', free: '—', prem: isAz ? 'Var' : 'Есть' },
              ].map((r, i) => (
                <View key={i} style={[styles.compareRow, styles.featureRule]}>
                  <Text variant="caption" style={styles.flex}>{r.l}</Text>
                  <Text variant="caption" tone="secondary" style={styles.compareCol}>{r.free}</Text>
                  <View style={[styles.compareCol, styles.premCell, { backgroundColor: accent.soft }]}>
                    <Text variant="caption" style={{ color: accent.ink, fontFamily: fontFamily.bodyBlack }}>{r.prem}</Text>
                  </View>
                </View>
              ))}
            </HBCard>
          </Animated.View>

          {/* Тарифы */}
          {loading ? (
            <ActivityIndicator color={accent.bottom} size="large" style={styles.loader} />
          ) : (
            <Animated.View entering={FadeInUp.duration(450).delay(260)} style={styles.packages}>
              {annualPkg ? (
                <PlanCard
                  selected={selectedAnnual}
                  title={isAz ? 'İllik' : 'Годовой'}
                  sub={annualMonthlyPrice(annualPkg)}
                  price={priceStr(annualPkg)}
                  badge={saved !== null ? (isAz ? `Sərfəli · −${saved}%` : `Выгоднее на ${saved}%`) : null}
                  onPress={() => setSelectedPkg(annualPkg)}
                />
              ) : null}
              {monthlyPkg ? (
                <PlanCard
                  selected={selectedMonthly}
                  title={isAz ? 'Aylıq' : 'Помесячно'}
                  price={priceStr(monthlyPkg)}
                  onPress={() => setSelectedPkg(monthlyPkg)}
                />
              ) : null}
              {!annualPkg && !monthlyPkg ? (
                <InlineBanner
                  tone="danger"
                  text={
                    isAz
                      ? 'Abunəlik məlumatları yüklənmədi. Bir az sonra yenidən cəhd edin.'
                      : 'Не удалось загрузить тарифы. Попробуйте чуть позже.'
                  }
                />
              ) : null}
            </Animated.View>
          )}

          {/* Покупка */}
          <Animated.View entering={FadeInUp.duration(450).delay(320)} style={styles.cta}>
            <HBButton
              full
              icon="crown"
              loading={purchasing}
              label={
                purchasing
                  ? isAz ? 'Alınır…' : 'Покупка…'
                  : isAz ? `${FREE_DAYS} gün pulsuz yoxla` : `Попробовать ${FREE_DAYS} дней бесплатно`
              }
              onPress={handlePurchase}
              disabled={purchasing || !selectedPkg}
            />
            <HBButton
              full
              variant="ghost"
              loading={restoring}
              label={isAz ? 'Alışları bərpa et' : 'Восстановить покупки'}
              onPress={handleRestore}
              disabled={restoring}
            />
            <Text variant="caption" tone="secondary" align="center">
              {isAz
                ? 'Abunəlik avtomatik yenilənir. İstənilən vaxt Google Play-də ləğv etmək olar.'
                : 'Подписка продлевается сама. Отменить можно в любой момент в Google Play.'}
            </Text>
          </Animated.View>
        </ScrollView>
      </PaperBackground>
    </UIModeProvider>
  );
}

function PlanCard({
  selected,
  title,
  sub,
  price,
  badge,
  onPress,
}: {
  selected: boolean;
  title: string;
  sub?: string;
  price: string;
  badge?: string | null;
  onPress: () => void;
}) {
  const { mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const accent = useAccent();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <HBCard
        ringColor={selected ? accent.bottom : undefined}
        bg={selected ? accent.soft : undefined}
        style={styles.planCard}
      >
        {badge ? (
          <View style={[styles.badge, { backgroundColor: accent.bottom }]}>
            <Text style={[styles.badgeText, { color: accent.text }]}>{badge}</Text>
          </View>
        ) : null}
        <View style={[styles.radio, selected && { borderColor: accent.bottom, backgroundColor: accent.bottom }]}>
          {selected ? <Icon name="check" size={14} color={accent.text} strokeWidth={3} /> : null}
        </View>
        <View style={styles.flex}>
          <Text variant="bodyBold">{title}</Text>
          {sub ? <Text variant="caption" tone="secondary">{sub}</Text> : null}
        </View>
        <Text style={styles.price}>{price}</Text>
      </HBCard>
    </Pressable>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  scroll: { paddingTop: spacing[1], paddingBottom: spacing[10], gap: spacing[4] },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },

  hero: { alignItems: 'center', gap: spacing[2] },
  halo: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownWrap: { position: 'absolute', top: 2 },
  premiumChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  premiumChipText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize['2xs'], color: '#7F6628', letterSpacing: 1.2 },

  features: { gap: 0, paddingVertical: spacing[1] },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] },
  featureRule: { borderTopWidth: 1, borderTopColor: t.c.surfaceBorder },

  compare: { paddingVertical: spacing[1] },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2] },
  compareCol: { width: 84, textAlign: 'center' },
  premCell: { borderRadius: radius.sm, paddingVertical: 3, alignItems: 'center' },

  loader: { marginVertical: spacing[6] },
  packages: { gap: spacing[3] },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[4] },
  badge: {
    position: 'absolute',
    top: -10,
    right: spacing[3],
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  badgeText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize['2xs'] },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: t.c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  price: { fontFamily: fontFamily.display, fontSize: fontSize.lg, color: t.c.ink },

  cta: { gap: spacing[2] },
}));
