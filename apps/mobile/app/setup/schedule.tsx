import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { HBButton } from '@/components/HBButton';
import { scheduleLessonReminders } from '@/services/notifications';
import { useSettings, type ScheduleDay, type ScheduleMinutes } from '@/store/settings';
import { useCompanionName } from '@/utils/companion';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing } from '@/theme';
import { StepIndicator } from './name';

const DAYS: { key: ScheduleDay; labelRu: string; labelAz: string }[] = [
  { key: 'mon', labelRu: 'Пн', labelAz: 'B.e' },
  { key: 'tue', labelRu: 'Вт', labelAz: 'Ç.a' },
  { key: 'wed', labelRu: 'Ср', labelAz: 'Çər' },
  { key: 'thu', labelRu: 'Чт', labelAz: 'C.a' },
  { key: 'fri', labelRu: 'Пт', labelAz: 'Cüm' },
  { key: 'sat', labelRu: 'Сб', labelAz: 'Şnb' },
  { key: 'sun', labelRu: 'Вс', labelAz: 'Baz' },
];

const DURATIONS: { value: ScheduleMinutes; emoji: string }[] = [
  { value: 10, emoji: '⚡' },
  { value: 15, emoji: '🌟' },
  { value: 20, emoji: '🔥' },
  { value: 30, emoji: '🏆' },
  { value: 45, emoji: '🚀' },
  { value: 60, emoji: '👑' },
];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7–22

export default function SetupScheduleScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const setSchedule = useSettings((s) => s.setSchedule);
  const setProactiveOptIn = useSettings((s) => s.setProactiveOptIn);
  const authToken = useSettings((s) => s.authToken);
  const bot = useCompanionName();

  const isAz = lang === 'az';

  const [days, setDays] = useState<ScheduleDay[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [minutes, setMinutes] = useState<ScheduleMinutes>(15);
  const [hour, setHour] = useState(17);
  const [proactiveOn, setProactiveOn] = useState(false); // opt-in, default OFF

  const toggleDay = (day: ScheduleDay) => {
    Haptics.selectionAsync().catch(() => {});
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleContinue = () => {
    if (days.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSchedule(days, minutes, hour);
    setProactiveOptIn(proactiveOn);
    // Schedule push notifications (best effort)
    scheduleLessonReminders(childName, hour, days, isAz).catch(() => {});
    // Straight to the AI-plan build progress (no static "план готов" summary):
    // authenticated → building creates the child itself; otherwise account first.
    if (authToken) router.replace('/setup/building?create=1' as any);
    else router.push('/auth/consent' as any);
  };

  const formatHour = (h: number) => {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const display = h > 12 ? h - 12 : h;
    return `${display}:00 ${suffix}`;
  };

  return (
    <Screen gradient decoration="sunrise" scroll>
      <StepIndicator current={7} total={7} />

      <Animated.View entering={FadeInDown.duration(600).delay(100)} style={styles.header}>
        <Text style={{ fontSize: scaleFont(52), textAlign: 'center' }}>⏰</Text>
        <Text variant="title" align="center" style={{ marginTop: spacing[4] }}>
          {isAz
            ? `${childName} nə vaxt oxuyacaq?`
            : `Когда ${childName} будет заниматься?`}
        </Text>
        <Text variant="subtitle" tone="secondary" align="center" style={{ marginTop: spacing[3] }}>
          {isAz
            ? `${bot} hər gün xatırladacaq`
            : `${bot} будет напоминать каждый день`}
        </Text>
      </Animated.View>

      {/* Days */}
      <Animated.View entering={FadeInUp.duration(500).delay(200)}>
        <Text style={styles.sectionLabel}>
          {isAz ? 'Günlər' : 'Дни недели'}
        </Text>
        <View style={styles.daysRow}>
          {DAYS.map((d) => {
            const active = days.includes(d.key);
            return (
              <Pressable
                key={d.key}
                onPress={() => toggleDay(d.key)}
                style={[styles.dayBtn, active && styles.dayBtnActive]}
              >
                <Text style={[styles.dayText, active && styles.dayTextActive]}>
                  {isAz ? d.labelAz : d.labelRu}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* Duration */}
      <Animated.View entering={FadeInUp.duration(500).delay(300)}>
        <Text style={styles.sectionLabel}>
          {isAz ? 'Müddət' : 'Сколько времени в день'}
        </Text>
        <View style={styles.durationRow}>
          {DURATIONS.map((d) => (
            <Pressable
              key={d.value}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setMinutes(d.value);
              }}
              style={[styles.durationBtn, minutes === d.value && styles.durationBtnActive, shadow.sm]}
            >
              <Text style={{ fontSize: 20 }}>{d.emoji}</Text>
              <Text style={[styles.durationText, minutes === d.value && { color: colors.white }]}>
                {d.value} {isAz ? 'dəq' : 'мин'}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {/* Time */}
      <Animated.View entering={FadeInUp.duration(500).delay(400)}>
        <Text style={styles.sectionLabel}>
          {isAz ? 'Saat' : 'Время урока'}
        </Text>
        <View style={styles.hoursWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hoursScroll}
          >
            {HOURS.map((h) => (
              <Pressable
                key={h}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setHour(h);
                }}
                style={[styles.hourBtn, hour === h && styles.hourBtnActive, shadow.sm]}
              >
                <Text style={[styles.hourText, hour === h && { color: colors.white }]}>
                  {h}:00
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {/* Right fade — hints at more items to scroll */}
          <View style={styles.hoursFade} pointerEvents="none" />
        </View>
      </Animated.View>

      {/* Companion proactive opt-in (default off) */}
      <Animated.View entering={FadeInUp.duration(500).delay(450)}>
        <Text style={styles.sectionLabel}>{bot}</Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setProactiveOn((v) => !v);
          }}
          style={[styles.toggleRow, shadow.sm]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>
              {isAz ? `${bot} özü yazsın` : `${bot} пишет первым`}
            </Text>
            <Text style={styles.toggleSub}>
              {isAz
                ? 'Keçən söhbətləri xatırlayıb vaxtında soruşar (məs. həftəsonu necə keçdi). İstənilən vaxt söndürmək olar.'
                : 'Вспомнит прошлый разговор и спросит вовремя (например, как прошли выходные). Можно выключить в любой момент.'}
            </Text>
          </View>
          <View style={[styles.switch, proactiveOn && styles.switchOn]}>
            <View style={[styles.knob, proactiveOn && styles.knobOn]} />
          </View>
        </Pressable>
      </Animated.View>

      {/* Summary */}
      <Animated.View entering={FadeInUp.duration(400).delay(500)} style={[styles.summary, shadow.md]}>
        <Text style={styles.summaryText}>
          {isAz
            ? `📅 ${days.length} gün · ⏱ ${minutes} dəq · ⏰ ${formatHour(hour)}`
            : `📅 ${days.length} дней · ⏱ ${minutes} мин · ⏰ ${formatHour(hour)}`}
        </Text>
      </Animated.View>

      <HBButton
        full
        variant={days.length === 0 ? 'soft' : 'primary'}
        label={isAz ? 'Planı göstər 🎉' : 'Показать план 🎉'}
        onPress={handleContinue}
        disabled={days.length === 0}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing[2], marginBottom: spacing[6], paddingHorizontal: spacing[2] },
  sectionLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.caption,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[3],
    marginTop: spacing[5],
  },
  daysRow: { flexDirection: 'row', gap: spacing[2] },
  dayBtn: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  dayBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize['2xs'], color: colors.inkSoft },
  dayTextActive: { color: colors.white },

  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  durationBtn: {
    flexBasis: '30%',
    flexGrow: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    gap: spacing[1],
    borderWidth: 2,
    borderColor: colors.border,
  },
  durationBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  durationText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.xs, color: colors.ink },

  hoursWrap: { position: 'relative' },
  hoursScroll: { gap: spacing[2], paddingRight: spacing[8] },
  hoursFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    backgroundColor: 'transparent',
    borderRightWidth: 0,
    // Simulated right edge fade using shadow-like appearance
    shadowColor: colors.bg,
    shadowOffset: { width: -16, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  hourBtn: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
  },
  hourBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  hourText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.ink },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: colors.border,
  },
  toggleTitle: { fontFamily: fontFamily.bodyBlack, fontSize: scaleFont(15), color: colors.ink },
  toggleSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 4,
    lineHeight: 17,
  },
  switch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: colors.accent },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    ...shadow.sm,
  },
  knobOn: { alignSelf: 'flex-end' },

  summary: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing[4],
    alignItems: 'center',
    marginTop: spacing[6],
    marginBottom: spacing[4],
  },
  summaryText: { fontFamily: fontFamily.bodyBold, fontSize: scaleFont(15), color: colors.ink },

  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginBottom: spacing[6],
    ...shadow.glow,
  },
  btnDisabled: { backgroundColor: colors.border, shadowOpacity: 0, elevation: 0 },
  btnText: { color: colors.white, fontFamily: fontFamily.bodyBlack, fontSize: fontSize.button },
});
