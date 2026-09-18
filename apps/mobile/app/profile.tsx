/**
 * Вкладка «Профиль» — кто учится, вход в родительский раздел (за PIN), память
 * и домик персонажа, смена профиля, ночной режим, аккаунт и правовые ссылки.
 */

import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabs, BottomTabsSpacer } from '@/components/BottomTabs';
import { HBCard } from '@/components/HBCard';
import { HBIconBox } from '@/components/HBIconBox';
import { HBPet } from '@/components/HBPet';
import { Icon, type IconName } from '@/components/Icon';
import { PaperBackground } from '@/components/PaperBackground';
import { ParentalGateModal, useParentalGate } from '@/components/ParentalGate';
import { Text } from '@/components/Text';
import { useTheme } from '@/hooks/useTheme';
import { deleteAccount } from '@/services/api';
import { cancelAllReminders } from '@/services/notifications';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, semantic, spacing, tints } from '@/theme';
import { useCompanionName } from '@/utils/companion';

export default function ProfileScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const childAge = useSettings((s) => s.childAge) ?? 0;
  const isPremium = useSettings((s) => s.isPremium);
  const authToken = useSettings((s) => s.authToken);
  const userEmail = useSettings((s) => s.userEmail);
  const logout = useSettings((s) => s.logout);
  const bedtimeMode = useSettings((s) => s.bedtimeMode);
  const setBedtimeMode = useSettings((s) => s.setBedtimeMode);
  const setParentUILanguage = useSettings((s) => s.setParentUILanguage);
  const isAz = lang === 'az';
  const parentalGate = useParentalGate();
  const bot = useCompanionName();

  // Скрытый вход в проверку маскота: пять нажатий по версии за три секунды.
  const versionTaps = useRef<number[]>([]);
  const onVersionTap = () => {
    const now = Date.now();
    versionTaps.current = [...versionTaps.current.filter((t) => now - t < 3000), now];
    if (versionTaps.current.length >= 5) {
      versionTaps.current = [];
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.push('/dev/mascot' as any); // типы маршрутов обновятся при следующем expo start
    }
  };

  const { t, accent } = useTheme();
  const insets = useSafeAreaInsets();
  const handleAction = (action: () => void) => {
    Haptics.selectionAsync().catch(() => {});
    action();
  };

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    cancelAllReminders().catch(() => {});
    logout();
    router.replace('/auth/login' as any);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      isAz ? 'Hesabı silmək?' : 'Удалить аккаунт?',
      isAz
        ? 'Bütün uşaqların məlumatları (dərslər, dialoqlar, tərəqqi) həmişəlik silinəcək. Bu əməliyyatı geri qaytarmaq mümkün deyil.'
        : 'Все данные всех детей (уроки, диалоги, прогресс) будут безвозвратно удалены со всех серверов. Это действие нельзя отменить.',
      [
        { text: isAz ? 'Ləğv et' : 'Отмена', style: 'cancel' },
        {
          text: isAz ? 'Hə, sil' : 'Да, удалить',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            // Server-side erase (skip for guest sessions that never registered).
            if (authToken) await deleteAccount(authToken).catch(() => {});
            cancelAllReminders().catch(() => {});
            logout();
            router.replace('/auth/login' as any);
          },
        },
      ],
    );
  };

  const items: { icon: IconName; label: string; sub: string; onPress: () => void }[] = [
    {
      icon: 'chart-column',
      label: isAz ? 'Valideyn kabineti' : 'Кабинет родителя',
      sub: isAz ? 'Uşaqlar, tərəqqi, cədvəl' : 'Дети, прогресс, расписание',
      // За PIN родителя: раньше ребёнок открывал родительский раздел одним
      // нажатием, а хаб `/parent` был недостижим вовсе — вели сразу в отчёт.
      onPress: () => parentalGate.run(() => router.push('/parent' as never)),
    },
    {
      icon: 'brain',
      label: isAz ? `${bot} nəyi xatırlayır` : `Что ${bot} помнит`,
      sub: isAz ? 'Sənin haqqında faktlar' : 'Факты о тебе',
      onPress: () => handleAction(() => router.push('/memory' as any)),
    },
    {
      icon: 'house',
      label: isAz ? `${bot} evi` : `Дом ${bot}`,
      sub: isAz ? 'Hədiyyələr və qurmaqlar' : 'Награды и постройки',
      onPress: () => handleAction(() => router.push('/bobo-house' as any)),
    },
    {
      icon: 'users',
      label: isAz ? 'Profili dəyiş' : 'Сменить профиль',
      sub: isAz ? 'Başqa uşaq seç' : 'Выбрать другого ребёнка',
      onPress: () => handleAction(() => router.replace('/profile-select' as any)),
    },
    {
      icon: 'moon',
      label: isAz ? 'Yataq rejimi' : 'Ночной режим',
      sub: bedtimeMode === 'on'
        ? (isAz ? 'Həmişə açıq' : 'Всегда включён')
        : bedtimeMode === 'off'
        ? (isAz ? 'Bağlı' : 'Выключен')
        : (isAz ? 'Avtomatik (20:00–07:00)' : 'Авто (20:00–07:00)'),
      onPress: () => handleAction(() => {
        const next = bedtimeMode === 'auto' ? 'on' : bedtimeMode === 'on' ? 'off' : 'auto';
        setBedtimeMode(next);
      }),
    },
    {
      icon: 'languages',
      label: isAz ? 'Tətbiqin dili' : 'Язык приложения',
      // Переключается на месте. Экран `language` после выбора уводил на
      // `/welcome`, то есть заново в онбординг, — он удалён.
      sub: isAz ? 'Azərbaycanca · rus dilinə keç' : 'Русский · перейти на азербайджанский',
      onPress: () => handleAction(() => setParentUILanguage(isAz ? 'ru' : 'az')),
    },
    ...(isPremium
      ? []
      : [{
          icon: 'crown' as IconName,
          label: isAz ? 'Premium al' : 'Получить Premium',
          sub: isAz ? '30 günü aç' : 'Открой все 30 дней',
          onPress: () => parentalGate.run(() => router.push('/paywall' as any)),
        }]),
  ];

  return (
    <PaperBackground>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing[4], paddingHorizontal: t.density.padX, gap: t.density.gap },
        ]}
      >
        {/* Кто учится */}
        <Animated.View entering={FadeInDown.duration(450)}>
          <HBCard style={styles.identity}>
            <HBPet size={t.mascot.inline + 8} mood="happy" onTap={() => {}} />
            <View style={styles.flex}>
              <Text variant="title" numberOfLines={1}>{childName || bot}</Text>
              {childAge > 0 ? (
                <Text variant="caption" tone="secondary">{isAz ? `${childAge} yaş` : `${childAge} лет`}</Text>
              ) : null}
            </View>
            {isPremium ? (
              <View style={[styles.premium, { backgroundColor: tints.butter }]}>
                <Icon name="crown" size={14} color="#7F6628" fill={colors.butter} strokeWidth={2} />
                <Text style={styles.premiumText}>Premium</Text>
              </View>
            ) : null}
          </HBCard>
        </Animated.View>

        {/* Разделы */}
        <Animated.View entering={FadeInUp.duration(450).delay(80)} style={styles.list}>
          {items.map((item, i) => (
            <Pressable key={i} onPress={item.onPress} accessibilityRole="button">
              {({ pressed }) => (
                <HBCard style={[styles.row, pressed && styles.pressed]}>
                  <HBIconBox icon={item.icon} tint={accent.soft} iconColor={accent.ink} size={40} />
                  <View style={styles.flex}>
                    <Text variant="bodyBold" numberOfLines={1}>{item.label}</Text>
                    <Text variant="caption" tone="secondary" numberOfLines={1}>{item.sub}</Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={colors.inkSoft} />
                </HBCard>
              )}
            </Pressable>
          ))}
        </Animated.View>

        {/* Аккаунт */}
        {authToken ? (
          <Animated.View entering={FadeIn.duration(450).delay(160)}>
            <HBCard style={styles.account}>
              <Text variant="label" tone="secondary">{isAz ? 'Hesab' : 'Аккаунт'}</Text>
              {userEmail ? <Text variant="body">{userEmail}</Text> : null}
              <Pressable onPress={handleLogout} accessibilityRole="button" style={styles.logout} hitSlop={6}>
                <Icon name="log-out" size={16} color={semantic.danger} />
                <Text variant="bodyBold" style={{ color: semantic.danger }}>{isAz ? 'Çıxış' : 'Выйти'}</Text>
              </Pressable>
            </HBCard>
          </Animated.View>
        ) : null}

        {/* Правовое — должно быть на виду (Google Play, COPPA) */}
        <Animated.View entering={FadeIn.duration(450).delay(240)} style={styles.legalRow}>
          <Pressable onPress={() => router.push('/legal/privacy' as any)} style={styles.legalLink}>
            <Text variant="caption" tone="secondary">{isAz ? 'Məxfilik' : 'Конфиденциальность'}</Text>
          </Pressable>
          <Text variant="caption" tone="secondary">·</Text>
          <Pressable onPress={() => router.push('/legal/privacy' as any)} style={styles.legalLink}>
            <Text variant="caption" tone="secondary">{isAz ? 'Şərtlər' : 'Условия'}</Text>
          </Pressable>
          <Text variant="caption" tone="secondary">·</Text>
          <Pressable onPress={() => parentalGate.run(handleDeleteAccount)} style={styles.legalLink}>
            <Text variant="caption" style={{ color: semantic.danger }}>{isAz ? 'Hesabı sil' : 'Удалить аккаунт'}</Text>
          </Pressable>
        </Animated.View>

        <Text variant="caption" tone="secondary" align="center">
          {isAz ? 'Söz uşaqlar üçündür (5+). Valideyn nəzarəti ilə.' : 'Söz создан для детей 5+. С родительским контролем.'}
        </Text>

        <Pressable onPress={onVersionTap} hitSlop={8} style={styles.versionTap}>
          <Text style={styles.versionText}>Söz · {Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </Pressable>

        <BottomTabsSpacer />
      </ScrollView>

      <BottomTabs />
      <ParentalGateModal {...parentalGate.modalProps} />
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing[4] },
  flex: { flex: 1, minWidth: 0 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  premium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  premiumText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize['2xs'], color: '#7F6628' },
  list: { gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  pressed: { opacity: 0.8 },
  account: { gap: spacing[1] },
  logout: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start', paddingVertical: spacing[1] },
  legalRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: spacing[1] },
  legalLink: { paddingVertical: spacing[1], paddingHorizontal: spacing[1] },
  versionTap: { alignSelf: 'center', paddingVertical: spacing[2] },
  versionText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize['2xs'], color: colors.textMuted },
});
