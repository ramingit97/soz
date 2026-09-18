/**
 * Домик персонажа: за каждый пройденный день открывается предмет. Эмодзи
 * предметов — их рисунок (контент), интерфейс вокруг — на токенах и иконках.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBCard } from '@/components/HBCard';
import { HBIconBox } from '@/components/HBIconBox';
import { HBPet } from '@/components/HBPet';
import { Icon } from '@/components/Icon';
import { PaperBackground } from '@/components/PaperBackground';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useTheme } from '@/hooks/useTheme';
import { HOUSE_ITEMS, getNextItem, getUnlockedItems } from '@/services/boboHouse';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, scaleFont, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';

export default function BoboHouseScreen() {
  const currentDay = useSettings((s) => s.currentDay);
  const isAz = useSettings((s) => s.parentUILanguage) === 'az';
  const bot = useCompanionName();
  const { t, accent } = useTheme();

  const unlocked = getUnlockedItems(currentDay);
  const nextItem = getNextItem(currentDay);
  const total = HOUSE_ITEMS.length;

  return (
    <PaperBackground>
      {/* Без падежного окончания у имени: «Bobo evi» — имя может быть любым. */}
      <ScreenHeader title={isAz ? `${bot} evi` : `Дом ${bot}`} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: t.density.padX, gap: t.density.gap }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(450)}>
          <HBCard style={styles.hero}>
            <HBPet size={t.mascot.inline + 16} mood="happy" onTap={() => {}} />
            <View style={styles.flex}>
              <Text style={[styles.count, { color: accent.ink }]}>
                {unlocked.length}/{total}
              </Text>
              <Text variant="body" tone="secondary">
                {isAz ? 'əşya toplandı' : 'предметов собрано'}
              </Text>
            </View>
          </HBCard>
        </Animated.View>

        {nextItem ? (
          <Animated.View entering={FadeInUp.duration(450).delay(120)}>
            <HBCard bg={accent.soft} style={styles.row}>
              <HBIconBox icon="gift" tint={colors.surface} iconColor={accent.ink} size={48} />
              <View style={styles.flex}>
                <Text variant="label" style={{ color: accent.ink }}>
                  {isAz ? 'Növbəti hədiyyə' : 'Следующий подарок'}
                </Text>
                <Text variant="bodyBold">
                  {isAz ? nextItem.nameAz : nextItem.nameRu} {nextItem.emoji}
                </Text>
                <Text variant="caption" style={{ color: colors.ink }}>
                  {isAz ? `${nextItem.unlockDay}-ci günü bitir` : `Пройди день ${nextItem.unlockDay}`}
                </Text>
              </View>
            </HBCard>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInUp.duration(450).delay(200)} style={styles.grid}>
          {HOUSE_ITEMS.map((item) => {
            const isUnlocked = item.unlockDay < currentDay;
            return (
              <View
                key={item.id}
                style={[styles.item, isUnlocked ? styles.itemOpen : styles.itemLocked]}
                accessibilityLabel={isUnlocked ? (isAz ? item.nameAz : item.nameRu) : isAz ? 'Qapalıdır' : 'Закрыто'}
              >
                {isUnlocked ? (
                  <>
                    <Text style={styles.itemEmoji}>{item.emoji}</Text>
                    <Text style={styles.itemDay}>{isAz ? `G${item.unlockDay}` : `Д${item.unlockDay}`}</Text>
                  </>
                ) : (
                  <Icon name="lock" size={18} color={colors.textMuted} />
                )}
              </View>
            );
          })}
        </Animated.View>

        <Text variant="caption" tone="secondary" align="center">
          {isAz ? `Hər dərs ${bot} evi üçün yeni əşya açır` : `Каждый урок открывает новый предмет для дома ${bot}`}
        </Text>
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: spacing[2], paddingBottom: spacing[10] },
  flex: { flex: 1, minWidth: 0 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  count: { fontFamily: fontFamily.display, fontSize: scaleFont(36), lineHeight: scaleFont(42) },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], justifyContent: 'space-between' },
  item: {
    width: '18.5%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  itemOpen: { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
  itemLocked: { backgroundColor: colors.bgDeep, borderColor: colors.bgDeep },
  itemEmoji: { fontSize: scaleFont(24), lineHeight: scaleFont(30) },
  itemDay: { fontFamily: fontFamily.bodyBold, fontSize: fontSize['3xs'], color: colors.inkSoft },
});
