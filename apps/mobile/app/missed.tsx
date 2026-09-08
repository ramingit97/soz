/**
 * Honeybear · "We missed you" — return after a pause.
 *
 * Shown when a child returns after several days. Soft night halo, a tear and
 * zzz on a saturate-down Хани, streak-shield badge (if applicable), three
 * welcome-back gift tiles, and an easy-start CTA.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { useSettings, todayISO } from '@/store/settings';
import { useCompanionName } from '@/utils/companion';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

export default function MissedScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const bot = useCompanionName();
  const isAz = lang === 'az';
  const streak = useSettings((s) => s.streak);
  const lastCompletedDate = useSettings((s) => s.lastCompletedDate);

  const daysAway = lastCompletedDate
    ? Math.floor(
        (new Date(todayISO()).getTime() - new Date(lastCompletedDate).getTime()) / 86400000,
      )
    : 0;

  return (
    <PaperBackground variant="night">
      <View style={styles.container}>
        {/* night sparkles */}
        <Text style={[styles.starTl, { color: colors.butter }]}>✦</Text>
        <Text style={[styles.starTr, { color: '#9C7EE6' }]}>✦</Text>
        <Text style={styles.moon}>🌙</Text>

        <Animated.View entering={FadeInDown.duration(700)} style={styles.header}>
          <View style={styles.kicker}>
            <Text style={styles.kickerText}>
              {isAz
                ? `${daysAway || 4} GÜN KEÇDİ`
                : `ПРОШЛО ${daysAway || 4} ДНЯ`}
            </Text>
          </View>
          <Text style={styles.title}>
            {isAz ? 'Darıxdıq!' : 'Мы скучали!'}
          </Text>
          <Text style={styles.subtitle}>
            {isAz
              ? `${bot} tək qaldı. Gəl sözlərə qayıdaq?`
              : `${bot} грустил один. Давай вернёмся к словам?`}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(700).delay(200)} style={styles.petWrap}>
          <View style={styles.petHalo}>
            <View style={{ opacity: 0.75 }}>
              <HBPet size={150} mood="sad" />
            </View>
            <Text style={styles.zzz}>z<Text style={{ fontSize: 14 }}>z</Text><Text style={{ fontSize: 11 }}>z</Text></Text>
            <View style={styles.tear} />
          </View>
        </Animated.View>

        {streak > 0 && (
          <Animated.View entering={FadeInUp.duration(500).delay(400)}>
            <HBCard style={styles.shieldCard} depth="deep" bg={colors.butter}>
              <View style={styles.shieldIcon}>
                <Text style={{ fontSize: 22 }}>🛡️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shieldTitle}>
                  {isAz
                    ? `${streak} günlük seriyan saxlandı`
                    : `Стрик ${streak} дней сохранён`}
                </Text>
                <Text style={styles.shieldSub}>
                  {isAz
                    ? 'Qoruma işlədi — arıcıqlar köməyə gəldi!'
                    : 'Защита сработала — пчёлки заступились!'}
                </Text>
              </View>
            </HBCard>
          </Animated.View>
        )}

        <Animated.View entering={FadeInUp.duration(500).delay(500)} style={{ width: '100%' }}>
          <HBCard style={styles.giftsCard} depth="sm">
            <Text style={styles.giftsKicker}>
              {isAz ? 'QAYIDIŞ HƏDIYYƏSİ' : 'ПОДАРОК ЗА ВОЗВРАЩЕНИЕ'}
            </Text>
            <View style={styles.giftsRow}>
              {[
                { emoji: '⭐', label: isAz ? 'ulduz' : 'звёзд', value: '+30', tint: 'rgba(245, 212, 102, 0.5)' },
                { emoji: '🍯', label: isAz ? 'bal' : 'мёд', value: '×3', tint: 'rgba(229, 92, 115, 0.15)' },
                { emoji: '🎁', label: isAz ? 'geyim' : 'наряд', value: '1', tint: 'rgba(122, 201, 181, 0.2)' },
              ].map((g, i) => (
                <View key={i} style={[styles.giftTile, { backgroundColor: g.tint }]}>
                  <Text style={{ fontSize: 22 }}>{g.emoji}</Text>
                  <Text style={styles.giftValue}>{g.value}</Text>
                  <Text style={styles.giftLabel}>{g.label}</Text>
                </View>
              ))}
            </View>
          </HBCard>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(600)} style={{ width: '100%' }}>
          <HBCard style={styles.easyCard} depth="sm" bg="rgba(122, 201, 181, 0.15)">
            <View style={styles.easyIcon}>
              <Text style={{ fontSize: 14, color: colors.white }}>✨</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.easyTitle}>
                {isAz ? 'Asan başlanğıc — 3 dəqiqə' : 'Лёгкий старт — 3 минуты'}
              </Text>
              <Text style={styles.easySub}>
                {isAz
                  ? 'sevimli sözləri təkrarla, heç bir təzyiq yox'
                  : 'повтор любимых слов, никакого давления'}
              </Text>
            </View>
          </HBCard>
        </Animated.View>

        <View style={styles.cta}>
          <HBButton
            full
            variant="primary"
            label={isAz ? `${bot} ilə salamlaş` : `Поздороваться с ${bot}`}
            onPress={() => router.replace('/home')}
          />
        </View>
      </View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingTop: 64,
    paddingBottom: spacing[8],
    gap: spacing[3],
  },

  starTl: { position: 'absolute', top: 84, left: 24, fontSize: 16 },
  starTr: { position: 'absolute', top: 110, right: 30, fontSize: fontSize.xs },
  moon: { position: 'absolute', top: 60, right: 60, fontSize: 22 },

  header: { alignItems: 'center', gap: spacing[1] },
  kicker: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
    borderRadius: radius.full,
    ...shadow.sm,
  },
  kickerText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 11,
    color: colors.inkSoft,
    letterSpacing: 1.2,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'],
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  subtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: spacing[5],
    lineHeight: 19,
  },

  petWrap: { alignItems: 'center', marginVertical: spacing[2] },
  petHalo: {
    width: 200,
    height: 180,
    borderRadius: 100,
    backgroundColor: 'rgba(156, 126, 230, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  zzz: {
    position: 'absolute',
    top: 18,
    right: 18,
    fontSize: 22,
    color: '#7A5CD9',
    fontFamily: fontFamily.display,
  },
  tear: {
    position: 'absolute',
    top: 76,
    left: 84,
    width: 6,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#7AB5E8',
    transform: [{ rotate: '-12deg' }],
  },

  shieldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  shieldIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  shieldTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  shieldSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 2,
  },

  giftsCard: {
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  giftsKicker: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 10,
    color: colors.inkSoft,
    letterSpacing: 1.2,
  },
  giftsRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  giftTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    gap: 2,
  },
  giftValue: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  giftLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    color: colors.inkSoft,
  },

  easyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  easyIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  easyTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  easySub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: 1,
  },

  cta: { marginTop: 'auto' },
});
