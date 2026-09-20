import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { HBButton } from '@/components/HBButton';
import { scheduleLessonReminders } from '@/services/notifications';
import { useSettings, type ScheduleDay, type ScheduleMinutes } from '@/store/settings';
import { useCompanionName } from '@/utils/companion';
import { fontFamily, fontSize, radius, scaleFont, shadow, spacing } from '@/theme';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StepIndicator } from '@/components/StepIndicator';
import { useAccent } from '@/hooks/useAccent';
import { UIModeProvider } from '@/hooks/useUIMode';
import { updateChild } from '@/services/api';
import { makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

const DAYS: { key: ScheduleDay; labelRu: string; labelAz: string }[] = [
  { key: 'mon', labelRu: 'Пн', labelAz: 'B.e' },
  { key: 'tue', labelRu: 'Вт', labelAz: 'Ç.a' },
  { key: 'wed', labelRu: 'Ср', labelAz: 'Çər' },
  { key: 'thu', labelRu: 'Чт', labelAz: 'C.a' },
  { key: 'fri', labelRu: 'Пт', labelAz: 'Cüm' },
  { key: 'sat', labelRu: 'Сб', labelAz: 'Şnb' },
  { key: 'sun', labelRu: 'Вс', labelAz: 'Baz' },
];

const DURATIONS: ScheduleMinutes[] = [10, 15, 20, 30, 45, 60];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7–22

export default function SetupScheduleScreen() {
  const { mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const router = useRouter();
  // `?from=parent` — экран открыт как настройка из родительского раздела, а не
  // шаг онбординга: показываем текущее расписание, сохраняем и возвращаемся.
  // Раньше «Изменить» отсюда уводило в `setup/building?create=1`, то есть в
  // создание ещё одного ребёнка.
  const fromParent = useLocalSearchParams<{ from?: string }>().from === 'parent';
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const setSchedule = useSettings((s) => s.setSchedule);
  const setProactiveOptIn = useSettings((s) => s.setProactiveOptIn);
  const authToken = useSettings((s) => s.authToken);
  const childId = useSettings((s) => s.childId);
  const accent = useAccent();
  const bot = useCompanionName();

  const isAz = lang === 'az';

  const storedDays = useSettings((st) => st.scheduleDays);
  const storedMinutes = useSettings((st) => st.scheduleMinutes);
  const storedHour = useSettings((st) => st.scheduleHour);
  const storedProactive = useSettings((st) => st.proactiveOptIn);

  const [days, setDays] = useState<ScheduleDay[]>(storedDays);
  const [minutes, setMinutes] = useState<ScheduleMinutes>(storedMinutes);
  const [hour, setHour] = useState(storedHour);
  const [proactiveOn, setProactiveOn] = useState(storedProactive); // по умолчанию выключено

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
    if (fromParent) {
      // Расписание знает и сервер (напоминания, отчёт родителю) — раньше
      // «Сохранить» меняло его только на телефоне.
      if (childId && authToken) {
        updateChild(
          childId,
          { scheduleDays: days, scheduleMinutes: minutes, scheduleHour: hour, proactiveOptIn: proactiveOn ? 1 : 0 },
          authToken,
        ).catch(() => {});
      }
      router.back();
      return;
    }
    // Straight to the AI-plan build progress (no static "план готов" summary):
    // authenticated → building creates the child itself; otherwise account first.
    if (authToken) router.replace('/setup/building?create=1' as any);
    else router.push('/auth/consent?then=register' as any);
  };

  return (
    // Настройку делает родитель — «взрослый» режим.
    <UIModeProvider force="teen">
    <Screen scroll>
      {fromParent ? (
        // Открыт как настройка: шапка с выходом без сохранения.
        <ScreenHeader
          safeTop={false}
          title={isAz ? 'Cədvəl' : 'Расписание'}
          subtitle={isAz ? `${childName} nə vaxt oxuyur` : `Когда ${childName} занимается`}
          style={styles.settingsHeader}
        />
      ) : (
        <>
          <StepIndicator current={7} total={7} />
          <Animated.View entering={FadeInDown.duration(600).delay(100)} style={styles.header}>
            <Text variant="title" align="center">
              {isAz ? `${childName} nə vaxt oxuyacaq?` : `Когда ${childName} будет заниматься?`}
            </Text>
            <Text variant="subtitle" tone="secondary" align="center" style={{ marginTop: spacing[3] }}>
              {isAz ? `${bot} hər gün xatırladacaq` : `${bot} будет напоминать каждый день`}
            </Text>
          </Animated.View>
        </>
      )}

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
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                style={[styles.dayBtn, active && { backgroundColor: accent.bottom, borderColor: accent.bottom }]}
              >
                <Text style={[styles.dayText, active && { color: accent.text }]}>
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
          {DURATIONS.map((value) => (
            <Pressable
              key={value}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setMinutes(value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: minutes === value }}
              style={[styles.durationBtn, minutes === value && { backgroundColor: accent.bottom, borderColor: accent.bottom }]}
            >
              <Text style={[styles.durationText, minutes === value && { color: accent.text }]}>
                {value} {isAz ? 'dəq' : 'мин'}
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
        {/* Сеткой, а не прокруткой: выбранный час (обычно вечерний) виден сразу. */}
        <View style={styles.hoursGrid}>
            {HOURS.map((h) => (
              <Pressable
                key={h}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setHour(h);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: hour === h }}
                style={[styles.hourBtn, hour === h && { backgroundColor: accent.bottom, borderColor: accent.bottom }]}
              >
                <Text style={[styles.hourText, hour === h && { color: accent.text }]}>
                  {h}:00
                </Text>
              </Pressable>
            ))}
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
          accessibilityRole="switch"
          accessibilityState={{ checked: proactiveOn }}
          style={styles.toggleRow}
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
          <View style={[styles.switch, proactiveOn && { backgroundColor: accent.bottom }]}>
            <View style={[styles.knob, proactiveOn && styles.knobOn]} />
          </View>
        </Pressable>
      </Animated.View>

      {/* Summary */}
      <Animated.View entering={FadeInUp.duration(400).delay(500)} style={[styles.summary, { backgroundColor: accent.soft }]}>
        <Icon name="calendar" size={16} color={accent.ink} />
        <Text style={[styles.summaryText, { color: accent.ink }]}>
          {isAz
            ? `${days.length} gün · ${minutes} dəq · ${hour}:00`
            : `${days.length} ${daysRu(days.length)} · ${minutes} мин · ${hour}:00`}
        </Text>
      </Animated.View>

      <HBButton
        full
        icon={fromParent ? 'check' : undefined}
        label={fromParent ? (isAz ? 'Yadda saxla' : 'Сохранить') : isAz ? 'Planı göstər' : 'Показать план'}
        onPress={handleContinue}
        disabled={days.length === 0}
      />
    </Screen>
    </UIModeProvider>
  );
}

/** «1 день», «3 дня», «5 дней». */
function daysRu(n: number): string {
  const d10 = n % 10;
  const d100 = n % 100;
  if (d10 === 1 && d100 !== 11) return 'день';
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return 'дня';
  return 'дней';
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  header: { marginTop: spacing[2], marginBottom: spacing[6], paddingHorizontal: spacing[2] },
  settingsHeader: { paddingHorizontal: 0, marginBottom: spacing[3] },
  sectionLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.caption,
    color: t.c.inkSoft,
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
    backgroundColor: t.c.white,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: t.c.border,
  },
  dayText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize['2xs'], color: t.c.inkSoft },

  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  durationBtn: {
    flexBasis: '30%',
    flexGrow: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: t.c.white,
    alignItems: 'center',
    gap: spacing[1],
    borderWidth: 2,
    borderColor: t.c.border,
  },
  durationText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.xs, color: t.c.ink },

  hoursGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  hourBtn: {
    flexBasis: '22%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: t.c.white,
    borderWidth: 2,
    borderColor: t.c.border,
  },
  hourText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: t.c.ink },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: t.c.white,
    borderRadius: radius.xl,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: t.c.border,
  },
  toggleTitle: { fontFamily: fontFamily.bodyBlack, fontSize: scaleFont(15), color: t.c.ink },
  toggleSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: t.c.inkSoft,
    marginTop: 4,
    lineHeight: 17,
  },
  switch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: t.c.border,
    padding: 3,
    justifyContent: 'center',
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: t.c.white,
    ...shadow.sm,
  },
  knobOn: { alignSelf: 'flex-end' },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: radius.xl,
    padding: spacing[4],
    marginTop: spacing[6],
    marginBottom: spacing[4],
  },
  summaryText: { fontFamily: fontFamily.bodyBold, fontSize: scaleFont(15), color: t.c.ink },
}));
