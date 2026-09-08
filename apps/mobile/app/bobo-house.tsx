import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Bobo } from '@/components/Bobo';
import { HBBackButton } from '@/components/HBBackButton';
import { Text } from '@/components/Text';
import { HOUSE_ITEMS, getNextItem, getUnlockedItems } from '@/services/boboHouse';
import { useSettings } from '@/store/settings';
import { colors, gradients, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';

export default function BoboHouseScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const currentDay = useSettings((s) => s.currentDay);
  const isAz = lang === 'az';
  const bot = useCompanionName();

  const unlocked = getUnlockedItems(currentDay);
  const nextItem = getNextItem(currentDay);
  const total = HOUSE_ITEMS.length;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradients.night}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Stars */}
      {['✨', '⭐', '💫', '✨', '⭐', '✨'].map((s, i) => (
        <Animated.Text
          key={i}
          entering={FadeIn.duration(800).delay(i * 200)}
          style={[
            styles.star,
            {
              top: 40 + i * 60,
              left: i % 2 === 0 ? 20 + i * 10 : undefined,
              right: i % 2 !== 0 ? 30 + i * 12 : undefined,
              fontSize: 14 + (i % 3) * 6,
            },
          ]}
        >
          {s}
        </Animated.Text>
      ))}

      <HBBackButton />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
          <View style={styles.boboHalo}>
            <Bobo size={120} mood="happy" />
          </View>
          <Text style={styles.title}>
            {isAz ? `${bot}-nun evi` : `Дом ${bot}`}
          </Text>
          <Text style={styles.subtitle}>
            {isAz
              ? `${unlocked.length} / ${total} əşya toplandı`
              : `${unlocked.length} / ${total} предметов собрано`}
          </Text>
        </Animated.View>

        {nextItem && (
          <Animated.View
            entering={FadeInUp.duration(500).delay(200)}
            style={[styles.nextCard, shadow.md]}
          >
            <Text style={{ fontSize: 36 }}>🎁</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextLabel}>
                {isAz ? 'NÖVBƏTİ HƏDİYYƏ' : 'СЛЕДУЮЩИЙ ПОДАРОК'}
              </Text>
              <Text style={styles.nextName}>
                {isAz ? nextItem.nameAz : nextItem.nameRu} {nextItem.emoji}
              </Text>
              <Text style={styles.nextHint}>
                {isAz
                  ? `${nextItem.unlockDay}-ci günü tamamla`
                  : `Открой день ${nextItem.unlockDay}`}
              </Text>
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInUp.duration(500).delay(300)} style={styles.grid}>
          {HOUSE_ITEMS.map((item, i) => {
            const isUnlocked = item.unlockDay < currentDay;
            return (
              <Animated.View
                key={item.id}
                entering={FadeInUp.duration(300).delay(i * 30)}
                style={[
                  styles.itemCard,
                  isUnlocked ? styles.itemUnlocked : styles.itemLocked,
                ]}
              >
                <Text style={[styles.itemEmoji, !isUnlocked && styles.itemEmojiLocked]}>
                  {isUnlocked ? item.emoji : '·'}
                </Text>
                {isUnlocked && (
                  <Text style={styles.itemDay}>
                    {isAz ? `G${item.unlockDay}` : `Д${item.unlockDay}`}
                  </Text>
                )}
              </Animated.View>
            );
          })}
        </Animated.View>

        <Text style={styles.footer}>
          {isAz
            ? `Hər dərs ${bot}-nun evi üçün yeni əşya açır 🌟`
            : 'Каждый урок открывает новый предмет для дома 🌟'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  star: { position: 'absolute', color: 'rgba(255,255,255,0.5)' },
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[16] ?? 64,
    paddingBottom: spacing[12],
    gap: spacing[4],
  },
  header: { alignItems: 'center', gap: spacing[2] },
  boboHalo: {
    padding: spacing[4],
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 203, 71, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255, 203, 71, 0.3)',
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'],
    color: colors.accentYellow,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  subtitle: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: 'rgba(255,255,255,0.8)',
  },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 203, 71, 0.4)',
    borderRadius: radius.xl,
    padding: spacing[4],
  },
  nextLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 10,
    color: colors.accentYellow,
    letterSpacing: 1,
  },
  nextName: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.cream,
    marginTop: 4,
  },
  nextHint: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    justifyContent: 'space-between',
  },
  itemCard: {
    width: '18.5%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  itemUnlocked: {
    backgroundColor: 'rgba(255, 203, 71, 0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 203, 71, 0.5)',
  },
  itemLocked: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  itemEmoji: { fontSize: 28 },
  itemEmojiLocked: { fontSize: 18, color: 'rgba(255,255,255,0.25)' },
  itemDay: {
    position: 'absolute',
    bottom: 3,
    fontFamily: fontFamily.bodyBlack,
    fontSize: 9,
    color: colors.accentYellow,
  },
  footer: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: spacing[2],
  },
});
