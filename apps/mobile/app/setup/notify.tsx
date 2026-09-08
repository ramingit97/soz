/**
 * Notification priming — explicit ask right after the account is created.
 * Explains the value first (higher grant rate than a cold OS prompt), then
 * requests permission and schedules the daily lesson reminders. "Later" skips
 * without nagging. Routes onward to the plan picker.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { requestNotificationPermission, scheduleLessonReminders } from '@/services/notifications';
import { useSettings } from '@/store/settings';
import { useCompanionName } from '@/utils/companion';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export default function SetupNotifyScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const scheduleHour = useSettings((s) => s.scheduleHour);
  const scheduleDays = useSettings((s) => s.scheduleDays);
  const petHue = useSettings((s) => s.petHue);
  const bot = useCompanionName();
  const isAz = lang === 'az';
  const [busy, setBusy] = useState(false);

  const next = () => router.replace('/setup/plan-select' as any);

  const handleAllow = async () => {
    if (busy) return;
    setBusy(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        await scheduleLessonReminders(
          childName || (isAz ? 'Uşaq' : 'Ребёнок'),
          scheduleHour,
          scheduleDays,
          isAz,
        );
      }
    } catch {
      /* ignore */
    }
    next();
  };

  return (
    <PaperBackground variant="honey">
      <View style={styles.container}>
        <View style={styles.center}>
          <Animated.View entering={FadeInDown.duration(500)}>
            <HBPet size={132} hue={petHue} mood="happy" />
          </Animated.View>
          <Animated.View entering={FadeInUp.duration(500).delay(150)} style={styles.textBlock}>
            <Text style={styles.title}>{isAz ? `🔔 ${bot} xatırlatsın?` : `🔔 ${bot} будет напоминать?`}</Text>
            <Text style={styles.sub}>
              {isAz
                ? `Hər gün saat ${scheduleHour}:00-da nəzakətlə dərsi xatırladacaq — seriyanı qırmamaq üçün.`
                : `Каждый день в ${scheduleHour}:00 мягко напомнит про урок — чтобы не терять серию 🔥`}
            </Text>
          </Animated.View>
        </View>

        <View style={styles.cta}>
          <HBButton
            full
            variant="primary"
            label={isAz ? 'Bildirişlərə icazə ver' : 'Разрешить уведомления'}
            onPress={handleAllow}
          />
          <Pressable onPress={next} style={styles.later} hitSlop={8} disabled={busy}>
            <Text style={styles.laterText}>{isAz ? 'Sonra' : 'Позже'}</Text>
          </Pressable>
        </View>
      </View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing[6], paddingTop: 60, paddingBottom: spacing[8] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[5] },
  textBlock: { alignItems: 'center', gap: spacing[3] },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'],
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  sub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  cta: { gap: spacing[2] },
  later: { alignSelf: 'center', paddingVertical: spacing[3] },
  laterText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.base, color: colors.inkSoft },
});
