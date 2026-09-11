/**
 * Profile tab — child identity, parent area, settings, logout.
 * Acts as the "drawer replacement" for settings-level navigation.
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { BottomTabs, BottomTabsSpacer } from '@/components/BottomTabs';
import { PaperBackground } from '@/components/PaperBackground';
import { ParentalGateModal, useParentalGate } from '@/components/ParentalGate';
import { Text } from '@/components/Text';
import { deleteAccount } from '@/services/api';
import { cancelAllReminders } from '@/services/notifications';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';

const AVATAR_COLORS = ['#7C3AED', '#059669', '#DC2626', '#D97706', '#2563EB', '#DB2777'];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? '#7C3AED';
}

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
  const isAz = lang === 'az';
  const parentalGate = useParentalGate();
  const bot = useCompanionName();

  const initial = childName.charAt(0).toUpperCase() || 'B';
  const color = avatarColor(childName || 'B');

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

  const items = [
    {
      icon: '📊',
      label: isAz ? 'Valideyn kabineti' : 'Кабинет родителя',
      sub: isAz ? 'Tərəqqi və analiz' : 'Прогресс и анализ',
      onPress: () => handleAction(() => router.push('/parent-summary' as any)),
    },
    {
      icon: '🧠',
      label: isAz ? `${bot} nəyi xatırlayır` : `Что ${bot} помнит`,
      sub: isAz ? 'Sənin haqqında faktlar' : 'Факты о тебе',
      onPress: () => handleAction(() => router.push('/memory' as any)),
    },
    {
      icon: '🏠',
      label: isAz ? `${bot} evi` : `Дом ${bot}`,
      sub: isAz ? 'Hədiyyələr və qurmaqlar' : 'Награды и постройки',
      onPress: () => handleAction(() => router.push('/bobo-house' as any)),
    },
    {
      icon: '👥',
      label: isAz ? 'Profili dəyiş' : 'Сменить профиль',
      sub: isAz ? 'Başqa uşaq seç' : 'Выбрать другого ребёнка',
      onPress: () => handleAction(() => router.replace('/profile-select' as any)),
    },
    {
      icon: '🌙',
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
    ...(isPremium
      ? []
      : [{
          icon: '👑',
          label: isAz ? 'Premium al' : 'Получить Premium',
          sub: isAz ? '30 günü aç' : 'Открой все 30 дней',
          onPress: () => parentalGate.run(() => router.push('/paywall' as any)),
        }]),
  ];

  return (
    <PaperBackground>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: color }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{childName || 'Bobo'}</Text>
          {childAge > 0 && (
            <Text style={styles.subtitle}>
              {isAz ? `${childAge} yaş` : `${childAge} лет`}
            </Text>
          )}
          {isPremium && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumText}>👑 PREMIUM</Text>
            </View>
          )}
        </Animated.View>

        {/* Action list */}
        <Animated.View entering={FadeInUp.duration(500).delay(100)} style={styles.section}>
          {items.map((item, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.row, shadow.sm, pressed && { opacity: 0.7 }]}
              onPress={item.onPress}
            >
              <View style={styles.rowIconWrap}>
                <Text style={styles.rowIcon}>{item.icon}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowSub}>{item.sub}</Text>
              </View>
              <Text style={styles.rowArrow}>›</Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Account / Logout */}
        {authToken && (
          <Animated.View entering={FadeIn.duration(500).delay(200)} style={styles.accountSection}>
            <Text style={styles.accountLabel}>
              {isAz ? 'HESAB' : 'АККАУНТ'}
            </Text>
            {userEmail && (
              <Text style={styles.email}>{userEmail}</Text>
            )}
            <Pressable onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>
                {isAz ? 'Çıxış' : 'Выйти'}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Legal — required visibility for App Store / COPPA */}
        <Animated.View entering={FadeIn.duration(500).delay(300)} style={styles.legalRow}>
          <Pressable onPress={() => router.push('/legal/privacy' as any)} style={styles.legalLink}>
            <Text style={styles.legalText}>
              {isAz ? 'Məxfilik' : 'Конфиденциальность'}
            </Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable onPress={() => router.push('/legal/privacy' as any)} style={styles.legalLink}>
            <Text style={styles.legalText}>
              {isAz ? 'Şərtlər' : 'Условия'}
            </Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable
            onPress={() => parentalGate.run(handleDeleteAccount)}
            style={styles.legalLink}
          >
            <Text style={styles.legalText}>
              {isAz ? 'Hesabı sil' : 'Удалить аккаунт'}
            </Text>
          </Pressable>
        </Animated.View>

        <Text style={styles.coppaNote}>
          {isAz
            ? 'Söz uşaqlar üçündür (5+). Valideyn nəzarəti ilə.'
            : 'Söz создан для детей 5+. С родительским контролем.'}
        </Text>

        <BottomTabsSpacer />
      </ScrollView>

      <BottomTabs />
      <ParentalGateModal {...parentalGate.modalProps} />
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[12],
  },

  header: {
    alignItems: 'center',
    marginBottom: spacing[6],
    gap: spacing[2],
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.white,
    fontFamily: fontFamily.display,
    fontSize: scaleFont(40),
  },
  name: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'],
    color: colors.ink,
    letterSpacing: -0.5,
    marginTop: spacing[2],
  },
  subtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
  premiumBadge: {
    backgroundColor: '#FFFBEA',
    borderWidth: 1,
    borderColor: colors.accentYellow,
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
    borderRadius: radius.full,
    marginTop: spacing[2],
  },
  premiumText: {
    color: '#B45309',
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xs,
    letterSpacing: 1,
  },

  section: {
    gap: spacing[2],
    marginBottom: spacing[6],
  },
  row: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  rowIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIcon: { fontSize: 22 },
  rowText: { flex: 1 },
  rowLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  rowSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
  },
  rowArrow: {
    fontSize: fontSize['2xl'],
    color: colors.inkSoft,
    fontFamily: fontFamily.bodyBold,
  },

  accountSection: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing[4],
    gap: spacing[2],
    ...shadow.sm,
  },
  accountLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    letterSpacing: 1.5,
  },
  email: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
  logoutBtn: {
    paddingVertical: spacing[2],
    alignSelf: 'flex-start',
  },
  logoutText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.error,
  },

  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[6],
    flexWrap: 'wrap',
  },
  legalLink: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
  },
  legalText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },
  legalDot: {
    color: colors.inkSoft,
    fontSize: fontSize.base,
  },
  coppaNote: {
    textAlign: 'center',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: spacing[3],
    fontStyle: 'italic',
  },
});
