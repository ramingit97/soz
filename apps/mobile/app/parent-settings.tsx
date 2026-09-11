/**
 * Honeybear · Parent Settings.
 *
 * Behind the parental gate. Profile chip with Premium badge, then three
 * sectioned cards: Time (daily limit slider + quiet hours toggle), Sound &
 * voice (rows with values), and Notifications/Difficulty/Logout.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBBackButton } from '@/components/HBBackButton';
import { HBCard } from '@/components/HBCard';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { useSettings } from '@/store/settings';
import { useCompanionName } from '@/utils/companion';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <Pressable
      onPress={onChange}
      style={[
        styles.toggle,
        { backgroundColor: value ? colors.primary : colors.bgDeep },
      ]}
    >
      <View
        style={[
          styles.toggleKnob,
          { left: value ? 22 : 3 },
          shadow.sm,
        ]}
      />
    </Pressable>
  );
}

export default function ParentSettingsScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const bot = useCompanionName();
  const isAz = lang === 'az';
  const isPremium = useSettings((s) => s.isPremium);
  const userEmail = useSettings((s) => s.userEmail);
  const childName = useSettings((s) => s.childName);
  const dailyGoal = useSettings((s) => s.dailyGoal);
  const setDailyGoal = useSettings((s) => s.setDailyGoal);
  const soundEnabled = useSettings((s) => s.soundEnabled);
  const setSoundEnabled = useSettings((s) => s.setSoundEnabled);

  const [quietHours, setQuietHours] = useState(true);
  const [notifications, setNotifications] = useState(true);

  return (
    <PaperBackground variant="parchment">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.topBar}>
          <HBBackButton inline />
          <Text style={styles.title}>
            {isAz ? 'Tənzimləmələr' : 'Настройки'}
          </Text>
          <View style={{ width: 36 }} />
        </Animated.View>

        {/* Profile chip */}
        <Animated.View entering={FadeIn.duration(400).delay(60)}>
          <HBCard style={styles.profileCard} depth="sm">
            <View style={styles.profileAvatar}>
              <Text style={{ fontSize: 26 }}>👤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>
                {childName ? `${childName}` : (isAz ? 'Profil' : 'Профиль')}
              </Text>
              {userEmail ? (
                <Text style={styles.profileEmail}>{userEmail}</Text>
              ) : null}
            </View>
            {isPremium ? (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumText}>Premium</Text>
              </View>
            ) : null}
          </HBCard>
        </Animated.View>

        {/* Section: Time */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {isAz ? 'TƏTBİQ VAXTI' : 'ВРЕМЯ ЗА ПРИЛОЖЕНИЕМ'}
          </Text>
          <Animated.View entering={FadeInUp.duration(400).delay(100)}>
            <HBCard style={styles.sectionCard} depth="sm">
              <View style={styles.row}>
                <Text style={styles.rowLabel}>
                  {isAz ? 'Günlük limit' : 'Лимит в день'}
                </Text>
                <Text style={styles.rowValue}>
                  {isAz ? `${dailyGoal * 6} dəq` : `${dailyGoal * 6} мин`}
                </Text>
              </View>
              {/* simple slider visualization */}
              <View style={styles.sliderTrack}>
                <View
                  style={[
                    styles.sliderFill,
                    { width: `${Math.min(100, (dailyGoal / 10) * 100)}%` },
                  ]}
                />
                <View
                  style={[
                    styles.sliderKnob,
                    { left: `${Math.min(95, (dailyGoal / 10) * 100)}%` },
                    shadow.deep,
                  ]}
                />
              </View>
              <View style={styles.sliderEnds}>
                <Pressable onPress={() => setDailyGoal(Math.max(1, dailyGoal - 1))}>
                  <Text style={styles.sliderEndText}>1 ⭐</Text>
                </Pressable>
                <Pressable onPress={() => setDailyGoal(Math.min(10, dailyGoal + 1))}>
                  <Text style={styles.sliderEndText}>10 ⭐</Text>
                </Pressable>
              </View>

              <View style={styles.rule} />

              <View style={styles.row}>
                <View>
                  <Text style={styles.rowLabel}>
                    {isAz ? 'Sakit saatlar' : 'Тихие часы'}
                  </Text>
                  <Text style={styles.rowSub}>22:00 → 8:00</Text>
                </View>
                <Toggle value={quietHours} onChange={() => setQuietHours((v) => !v)} />
              </View>
            </HBCard>
          </Animated.View>
        </View>

        {/* Section: Sound & voice */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {isAz ? 'SƏS & SƏS' : 'ЗВУК & ГОЛОС'}
          </Text>
          <Animated.View entering={FadeInUp.duration(400).delay(160)}>
            <HBCard style={styles.sectionCard} depth="sm">
              {[
                { icon: '🎙', l: isAz ? `${bot} səsi` : `Голос ${bot}`, sub: isAz ? 'şən, yumşaq' : 'весёлый, мягкий', val: 'Молли · UK' },
                {
                  icon: '🔔',
                  l: isAz ? 'Effekt səsləri' : 'Звуковые эффекты',
                  sub: isAz ? 'ulduzlar, düymələr' : 'звёзды, нажатия',
                  soundToggle: true,
                },
              ].map((r, i) => (
                <View key={i} style={[styles.listRow, i > 0 && styles.listRowBorder]}>
                  <View style={styles.listIcon}>
                    <Text style={{ fontSize: 16 }}>{r.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{r.l}</Text>
                    <Text style={styles.rowSub}>{r.sub}</Text>
                  </View>
                  {r.soundToggle ? (
                    <Toggle value={soundEnabled} onChange={() => setSoundEnabled(!soundEnabled)} />
                  ) : (
                    <View style={styles.valueChip}>
                      <Text style={styles.valueChipText}>{r.val}</Text>
                    </View>
                  )}
                </View>
              ))}
            </HBCard>
          </Animated.View>
        </View>

        {/* Section: Other */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {isAz ? 'DİGƏR' : 'ПРОЧЕЕ'}
          </Text>
          <Animated.View entering={FadeInUp.duration(400).delay(220)}>
            <HBCard style={styles.sectionCard} depth="sm">
              <View style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>
                    {isAz ? 'Bildirişlər' : 'Уведомления'}
                  </Text>
                  <Text style={styles.rowSub}>
                    {isAz ? 'axşam xatırlat' : 'напоминать вечером'}
                  </Text>
                </View>
                <Toggle value={notifications} onChange={() => setNotifications((v) => !v)} />
              </View>
              <View style={[styles.listRow, styles.listRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>
                    {isAz ? 'Çətinlik' : 'Сложность'}
                  </Text>
                  <Text style={styles.rowSub}>
                    {isAz ? 'adaptiv' : 'адаптивная'}
                  </Text>
                </View>
                <View style={styles.valueChip}>
                  <Text style={styles.valueChipText}>A1 ›</Text>
                </View>
              </View>
              <Pressable
                onPress={() => router.replace('/auth/login' as any)}
                style={[styles.listRow, styles.listRowBorder]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.berry }]}>
                    {isAz ? 'Hesabdan çıx' : 'Выйти из аккаунта'}
                  </Text>
                </View>
                <Text style={{ color: colors.inkSoft }}>›</Text>
              </Pressable>
            </HBCard>
          </Animated.View>
        </View>

        <Text style={styles.versionLabel}>
          Honeybear · версия 1.4.2
        </Text>
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[12],
    paddingBottom: spacing[8],
    gap: spacing[3],
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.ink,
  },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  profileEmail: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },
  premiumBadge: {
    backgroundColor: 'rgba(232, 148, 90, 0.15)',
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  premiumText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['2xs'],
    color: colors.primary,
  },

  section: { gap: spacing[2] },
  sectionLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['3xs'],
    color: colors.inkSoft,
    letterSpacing: 1.4,
    paddingLeft: spacing[2],
  },
  sectionCard: { gap: spacing[2] },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  rowSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['2xs'],
    color: colors.inkSoft,
    marginTop: 1,
  },
  rowValue: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.sm,
    color: colors.primary,
  },

  sliderTrack: {
    height: 6,
    backgroundColor: colors.bgDeep,
    borderRadius: 3,
    position: 'relative',
    marginTop: spacing[2],
    marginHorizontal: 10,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  sliderKnob: {
    position: 'absolute',
    top: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.primary,
    marginLeft: -10,
  },
  sliderEnds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  sliderEndText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['3xs'],
    color: colors.inkSoft,
  },

  rule: {
    height: 1,
    backgroundColor: colors.bgDeep,
    marginVertical: spacing[2],
  },

  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
  },
  listRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.bgDeep,
    borderStyle: 'dashed',
  },
  listIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueChip: {
    backgroundColor: colors.bgDeep,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  valueChipText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize['2xs'],
    color: colors.ink,
  },

  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    position: 'relative',
  },
  toggleKnob: {
    position: 'absolute',
    top: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
  },

  versionLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['2xs'],
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing[3],
  },
});
