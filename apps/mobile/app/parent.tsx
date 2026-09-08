import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Bobo } from '@/components/Bobo';
import { HBBackButton } from '@/components/HBBackButton';
import { ParentalGateModal, useParentalGate } from '@/components/ParentalGate';
import { Text } from '@/components/Text';
import { Alert } from 'react-native';
import { deleteChild, getChildren, getMe, getTalkQuota, sendVerification, type ChildProfile, type TalkQuota } from '@/services/api';
import { fetchFullCurriculum } from '@/services/curriculum';
import { cancelAllReminders } from '@/services/notifications';
import { useEffect, useState } from 'react';
import { useSettings, todayISO } from '@/store/settings';
import { colors, gradients, fontFamily, fontSize, radius, shadow, spacing, tints } from '@/theme';
import { useCompanionName } from '@/utils/companion';

const DAY_LABELS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAY_LABELS_AZ = ['B.e', 'Ça', 'Çə', 'Ca', 'Cü', 'Şə', 'Bz'];

function buildWeekActivity(lastCompletedDate: string | null, streak: number) {
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const dow = (d.getDay() + 6) % 7; // 0=Mon … 6=Sun

    let completed = false;
    if (lastCompletedDate) {
      const last = new Date(lastCompletedDate);
      const diffFromLast = Math.round((last.getTime() - d.getTime()) / 86400000);
      completed = diffFromLast >= 0 && diffFromLast < streak;
    }
    const isToday = iso === todayISO();
    days.push({ iso, dow, completed, isToday });
  }
  return days;
}

export default function ParentScreen() {
  const router = useRouter();
  const parentalGate = useParentalGate();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const childAge = useSettings((s) => s.childAge);
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const currentDay = useSettings((s) => s.currentDay);
  const totalStars = useSettings((s) => s.totalStars);
  const streak = useSettings((s) => s.streak);
  const lastCompletedDate = useSettings((s) => s.lastCompletedDate);
  const scheduleDays = useSettings((s) => s.scheduleDays);
  const scheduleMinutes = useSettings((s) => s.scheduleMinutes);
  const scheduleHour = useSettings((s) => s.scheduleHour);
  const userEmail = useSettings((s) => s.userEmail);
  const isPremium = useSettings((s) => s.isPremium);
  const logout = useSettings((s) => s.logout);
  const bot = useCompanionName();

  const isAz = lang === 'az';
  const weekActivity = buildWeekActivity(lastCompletedDate, streak);
  const dayLabels = isAz ? DAY_LABELS_AZ : DAY_LABELS_RU;
  const daysCompleted = Math.max(0, currentDay - 1);
  const vocabEstimate = daysCompleted * 5 * (learningLanguages.length || 1);
  const langFlags = learningLanguages.map((l) => (l === 'en' ? '🇬🇧' : '🇷🇺')).join(' ');
  const scheduleTimeStr = `${scheduleHour.toString().padStart(2, '0')}:00`;
  const weeklyActive = weekActivity.filter((d) => d.completed).length;

  const SCHEDULE_DAY_SHORT: Record<string, string> = isAz
    ? { mon: 'B.e', tue: 'Ça', wed: 'Çə', thu: 'Ca', fri: 'Cü', sat: 'Şə', sun: 'Bz' }
    : { mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Вс' };

  const childId = useSettings((s) => s.childId);
  const authToken = useSettings((s) => s.authToken);
  const syncChild = useSettings((s) => s.syncChild);
  const setChildId = useSettings((s) => s.setChildId);

  const [allChildren, setAllChildren] = useState<ChildProfile[]>([]);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [quota, setQuota] = useState<TalkQuota | null>(null);

  // Fetch all children for the active user + verification status + today's
  // conversation allowance (the limit is enforced server-side and was invisible
  // here — a child hitting it just got an error).
  useEffect(() => {
    if (!authToken) return;
    getChildren(authToken).then(setAllChildren).catch(() => {});
    getMe(authToken).then((me) => setEmailVerified(me.emailVerified)).catch(() => {});
    getTalkQuota(authToken).then(setQuota).catch(() => {});
  }, [authToken, childId]);

  const handleResendVerification = async () => {
    if (!authToken) return;
    Haptics.selectionAsync().catch(() => {});
    try {
      await sendVerification(authToken);
      router.push('/auth/verify-email' as any);
    } catch {
      // Even if resend fails, let them open the verify screen
      router.push('/auth/verify-email' as any);
    }
  };

  const handleSwitchChild = async (target: ChildProfile) => {
    if (target.id === childId || !authToken) return;
    Haptics.selectionAsync().catch(() => {});
    syncChild(target);
    // Pre-fetch the new child's curriculum
    for (const l of target.learningLanguages) {
      fetchFullCurriculum(target.id, l, authToken).catch(() => {});
    }
  };

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    cancelAllReminders().catch(() => {});
    logout();
    router.replace('/auth/login' as any);
  };

  // Delete THIS child's profile — NOT the whole account. Full-account erase lives
  // in profile.tsx (deleteAccount). After deleting, keep the parent signed in and
  // switch to a remaining child; only if this was the last child do we clear the
  // active pointer so profile-select doesn't resurrect the deleted one.
  const handleDeleteChild = () => {
    Alert.alert(
      isAz ? `${childName} profilini silmək?` : `Удалить профиль ${childName}?`,
      isAz
        ? `${childName}-in bütün məlumatları (dərslər, dialoqlar, tərəqqi) həmişəlik silinəcək. Bu əməliyyatı geri qaytarmaq mümkün deyil.`
        : `Все данные ${childName} (уроки, диалоги, прогресс) будут безвозвратно удалены. Это действие нельзя отменить.`,
      [
        { text: isAz ? 'Ləğv et' : 'Отмена', style: 'cancel' },
        {
          text: isAz ? 'Hə, sil' : 'Да, удалить',
          style: 'destructive',
          onPress: async () => {
            if (!childId || !authToken) return;
            await deleteChild(childId, authToken).catch(() => {});

            // Determine who's left — prefer a fresh fetch, fall back to the
            // locally-known list minus the deleted child if the network fails.
            let remaining = allChildren.filter((c) => c.id !== childId);
            try {
              remaining = await getChildren(authToken);
            } catch {
              /* offline — keep the local filter */
            }

            if (remaining.length > 0) {
              // Switch the active profile to a surviving child, then let the
              // parent re-pick from the roster.
              syncChild(remaining[0]!);
            } else {
              // Deleted the last child. Account persists, but there's nothing to
              // remind about and no active profile to point at.
              cancelAllReminders().catch(() => {});
              setChildId(null);
            }
            router.replace('/profile-select');
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.primarySoft, colors.cream, colors.cream]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Back button */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.topBar}>
        <HBBackButton inline />
        <Text style={styles.topTitle}>
          {isAz ? 'Valideyn' : 'Родителям'}
        </Text>
        <View style={{ width: 64 }} />
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >

        {/* Child summary card */}
        <Animated.View entering={FadeInDown.duration(600)} style={[styles.childCard, shadow.md]}>
          <Bobo size={80} mood="happy" />
          <View style={styles.childInfo}>
            <Text style={styles.childName}>{childName}</Text>
            {childAge && (
              <Text style={styles.childMeta}>
                {isAz ? `${childAge} yaş` : `${childAge} лет`}
                {langFlags ? `  ·  ${langFlags}` : ''}
              </Text>
            )}
            <View style={styles.dayBadge}>
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dayBadgeGrad}
              >
                <Text style={styles.dayBadgeText}>
                  {isAz ? `Gün ${currentDay} / 30` : `День ${currentDay} из 30`}
                </Text>
              </LinearGradient>
            </View>
          </View>
        </Animated.View>

        {/* Email verification banner */}
        {emailVerified === false && (
          <Animated.View entering={FadeInUp.duration(500).delay(80)}>
            <Pressable
              onPress={handleResendVerification}
              style={[styles.verifyBanner, shadow.sm]}
            >
              <Text style={{ fontSize: 22 }}>📩</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.verifyTitle}>
                  {isAz ? 'Email-i təsdiqlə' : 'Подтвердите email'}
                </Text>
                <Text style={styles.verifySub}>
                  {isAz
                    ? 'Şifrəni bərpa etmək üçün vacibdir'
                    : 'Чтобы можно было восстановить пароль'}
                </Text>
              </View>
              <Text style={{ fontSize: 18, color: '#D4A017' }}>→</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Multi-child switcher */}
        {allChildren.length > 0 && (
          <Animated.View entering={FadeInUp.duration(500).delay(100)} style={styles.childrenSection}>
            <Text style={styles.childrenLabel}>
              {isAz ? 'UŞAQLAR' : 'ДЕТИ'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.childrenRow}>
              {allChildren.map((c) => {
                const active = c.id === childId;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => handleSwitchChild(c)}
                    style={[styles.childPill, active && styles.childPillActive, shadow.sm]}
                  >
                    <Text style={[styles.childPillName, active && styles.childPillNameActive]}>
                      {c.name}
                    </Text>
                    <Text style={styles.childPillMeta}>
                      {isAz ? `Gün ${c.currentDay}` : `День ${c.currentDay}`} · ⭐{c.totalStars}
                    </Text>
                    {active && <View style={styles.childPillDot} />}
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => router.push('/parent-add-child' as any)}
                style={[styles.childAddBtn, shadow.sm]}
              >
                <Text style={styles.childAddPlus}>+</Text>
                <Text style={styles.childAddText}>
                  {isAz ? 'Əlavə et' : 'Добавить'}
                </Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        )}

        {/* Achievements + Transcripts links */}
        <Animated.View entering={FadeInUp.duration(500).delay(110)} style={{ gap: spacing[2] }}>
          <Pressable
            onPress={() => router.push('/achievements' as any)}
            style={[styles.achLink, shadow.sm]}
          >
            <Text style={{ fontSize: 24 }}>🏆</Text>
            <Text style={styles.achLinkText}>
              {isAz ? 'Nailiyyətlər' : 'Достижения'}
            </Text>
            <Text style={styles.achArrow}>→</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/parent-transcripts' as any)}
            style={[styles.achLink, shadow.sm]}
          >
            <Text style={{ fontSize: 24 }}>💬</Text>
            <Text style={styles.achLinkText}>
              {isAz ? `${childName}-in dialoqları` : `Диалоги ${childName}`}
            </Text>
            <Text style={styles.achArrow}>→</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/checkpoint' as any)}
            style={[styles.achLink, shadow.sm]}
          >
            <Text style={{ fontSize: 24 }}>🎚️</Text>
            <Text style={styles.achLinkText}>
              {isAz ? 'Dərsləri tənzimlə' : 'Настроить уроки'}
            </Text>
            <Text style={styles.achArrow}>→</Text>
          </Pressable>
        </Animated.View>

        {/* AI report banner — shown when child has any progress */}
        {currentDay >= 8 && (
          <Animated.View entering={FadeInUp.duration(500).delay(120)} style={[styles.aiReportCard, shadow.md]}>
            <View style={styles.aiReportLeft}>
              <Text style={{ fontSize: 32 }}>🤖</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.aiReportTitle}>
                  {isAz ? 'AI hesabatı və plan' : 'AI отчёт и план'}
                </Text>
                <Text style={styles.aiReportSub}>
                  {isAz
                    ? `${bot} nələri öyrəndiyini analiz etdi`
                    : `${bot} проанализировал прогресс`}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push('/parent-summary' as any)}
              style={styles.aiReportBtn}
            >
              <Text style={styles.aiReportBtnText}>→</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Stats row */}
        <Animated.View entering={FadeInUp.duration(500).delay(150)} style={styles.statsRow}>
          <StatCard emoji="🔥" value={streak} label={isAz ? 'Seriya' : 'Серия'} accent={colors.primary} bg={colors.primarySoft} />
          <StatCard emoji="⭐" value={totalStars} label={isAz ? 'Ulduz' : 'Звёзд'} accent={colors.butterDeep} bg={tints.butter} />
          <StatCard emoji="📚" value={vocabEstimate} label={isAz ? 'Söz' : 'Слов'} accent={colors.english} bg={colors.englishLight} />
        </Animated.View>

        {/* 7-day activity tracker */}
        <Animated.View entering={FadeInUp.duration(500).delay(250)} style={[styles.sectionCard, shadow.sm]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {isAz ? '7 günlük aktivlik' : '7 дней активности'}
            </Text>
            <View style={styles.weekBadge}>
              <Text style={styles.weekBadgeText}>
                {weeklyActive}/{weekActivity.length} {isAz ? 'gün' : 'дн'}
              </Text>
            </View>
          </View>
          <View style={styles.calendarRow}>
            {weekActivity.map((day, i) => (
              <View key={day.iso} style={styles.calDay}>
                <Text style={[styles.calDayLabel, day.isToday && styles.calDayLabelToday]}>
                  {dayLabels[day.dow]}
                </Text>
                <View style={[
                  styles.calDot,
                  day.completed && styles.calDotDone,
                  day.isToday && !day.completed && styles.calDotToday,
                ]}>
                  {day.completed
                    ? <Text style={{ fontSize: fontSize.xs }}>✓</Text>
                    : day.isToday
                    ? <Text style={{ fontSize: 10, color: colors.primary }}>·</Text>
                    : null
                  }
                </View>
              </View>
            ))}
          </View>
          {streak > 0 && (
            <Text style={styles.streakCaption}>
              {isAz
                ? `🔥 ${streak} günlük seriya davam edir!`
                : `🔥 Серия уже ${streak} ${streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'}!`}
            </Text>
          )}
        </Animated.View>

        {/* Schedule card */}
        <Animated.View entering={FadeInUp.duration(500).delay(350)} style={[styles.sectionCard, shadow.sm]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {isAz ? '📅 Cədvəl' : '📅 Расписание'}
            </Text>
            <Pressable
              onPress={() => router.push('/setup/schedule')}
              style={styles.editBtn}
            >
              <Text style={styles.editBtnText}>
                {isAz ? 'Dəyişdir' : 'Изменить'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.scheduleDaysRow}>
            {scheduleDays.map((d) => (
              <View key={d} style={styles.scheduleDayChip}>
                <Text style={styles.scheduleDayText}>{SCHEDULE_DAY_SHORT[d] ?? d}</Text>
              </View>
            ))}
          </View>
          <View style={styles.scheduleTimeRow}>
            <View style={styles.scheduleTimeChip}>
              <Text style={styles.scheduleTimeIcon}>⏰</Text>
              <Text style={styles.scheduleTimeText}>{scheduleTimeStr}</Text>
            </View>
            <View style={styles.scheduleTimeChip}>
              <Text style={styles.scheduleTimeIcon}>⏱</Text>
              <Text style={styles.scheduleTimeText}>
                {scheduleMinutes} {isAz ? 'dəq' : 'мин'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Account card */}
        <Animated.View entering={FadeInUp.duration(500).delay(450)} style={[styles.sectionCard, shadow.sm]}>
          <Text style={styles.sectionTitle}>
            {isAz ? '👤 Hesab' : '👤 Аккаунт'}
          </Text>
          {userEmail && (
            <View style={styles.emailRow}>
              <Text style={styles.emailText}>{userEmail}</Text>
            </View>
          )}

          {/* Subscription status */}
          {isPremium ? (
            <View style={styles.premiumBadge}>
              <Text style={{ fontSize: 18 }}>👑</Text>
              <Text style={styles.premiumText}>
                {isAz ? 'Söz Premium aktiv' : 'Söz Premium активен'}
              </Text>
            </View>
          ) : (
            <>
              {quota && !quota.premium && (
                <Text style={styles.quotaText}>
                  {isAz
                    ? `Bu gün ${quota.remaining} / ${quota.limit} söhbət qalıb`
                    : `Разговоров с Хани сегодня: осталось ${quota.remaining} из ${quota.limit}`}
                </Text>
              )}
              <Pressable
                onPress={() => parentalGate.run(() => router.push('/paywall' as any))}
                style={styles.upgradeBtn}
              >
                <Text style={styles.upgradeBtnText}>
                  {isAz ? '🚀 Premium almaq — bütün 30 günü aç' : '🚀 Получить Premium — открыть все 30 дней'}
                </Text>
              </Pressable>
            </>
          )}

          <Pressable onPress={() => router.push('/legal/privacy' as any)} style={styles.legalLink}>
            <Text style={styles.legalLinkText}>
              {isAz ? 'Məxfilik siyasəti' : 'Политика конфиденциальности'}
            </Text>
          </Pressable>

          <Pressable onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>
              {isAz ? 'Çıxış' : 'Выйти из аккаунта'}
            </Text>
          </Pressable>

          <Pressable onPress={handleDeleteChild} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>
              {isAz ? `🗑 ${childName} profilini sil` : `🗑 Удалить профиль ${childName}`}
            </Text>
          </Pressable>
        </Animated.View>

      </ScrollView>
      <ParentalGateModal {...parentalGate.modalProps} />
    </View>
  );
}

function StatCard({
  emoji,
  value,
  label,
  accent,
  bg,
}: {
  emoji: string;
  value: number;
  label: string;
  accent: string;
  bg: string;
}) {
  return (
    <View style={[styles.statCard, shadow.sm, { backgroundColor: bg }]}>
      <Text style={{ fontSize: 26 }}>{emoji}</Text>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: accent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[14] ?? 56,
    paddingBottom: spacing[3],
  },
  backLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.inkSoft,
  },
  topTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  scroll: { paddingHorizontal: spacing[5], paddingBottom: spacing[16] ?? 64, gap: spacing[4] },

  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing[5],
  },
  childInfo: { flex: 1, gap: spacing[1] },
  childName: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
  },
  childMeta: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
  dayBadge: { marginTop: spacing[2], alignSelf: 'flex-start' },
  dayBadgeGrad: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  dayBadgeText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xs,
    color: colors.card,
    letterSpacing: 0.5,
  },

  statsRow: { flexDirection: 'row', gap: spacing[3] },

  aiReportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing[4],
    gap: spacing[3],
    borderWidth: 2,
    borderColor: colors.primary,
  },
  aiReportLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1 },
  aiReportTitle: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.base,
    color: colors.primary,
  },
  aiReportSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
  },
  aiReportBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiReportBtnText: {
    color: colors.card,
    fontFamily: fontFamily.bodyBlack,
    fontSize: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    gap: spacing[1],
  },
  statValue: { fontFamily: fontFamily.display, fontSize: fontSize['2xl'] },
  statLabel: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.xs, textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing[5],
    gap: spacing[3],
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.base, color: colors.ink },

  // Calendar
  calendarRow: { flexDirection: 'row', justifyContent: 'space-between' },
  calDay: { alignItems: 'center', gap: spacing[2] },
  calDayLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    color: colors.inkSoft,
  },
  calDayLabelToday: { color: colors.primary },
  calDot: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDotDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  calDotToday: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  weekBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[0.5],
    borderRadius: radius.full,
  },
  weekBadgeText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  streakCaption: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
  },

  // Schedule
  scheduleDaysRow: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  scheduleDayChip: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  scheduleDayText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  scheduleTimeRow: { flexDirection: 'row', gap: spacing[3] },
  scheduleTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.cream,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
  },
  scheduleTimeIcon: { fontSize: 16 },
  scheduleTimeText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  editBtn: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  editBtnText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },

  // Account
  emailRow: {
    backgroundColor: colors.cream,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
  },
  emailText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.inkSoft,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: '#FFFBEA',
    borderWidth: 1.5,
    borderColor: colors.accentYellow,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  premiumText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: '#E8A000',
  },
  quotaText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  upgradeBtn: {
    backgroundColor: colors.accentYellow,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    ...shadow.sm,
  },
  upgradeBtnText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.midnight,
  },
  logoutBtn: {
    backgroundColor: '#FFF0F0',
    borderWidth: 1.5,
    borderColor: '#FFCDD2',
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  logoutText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.error,
  },
  legalLink: {
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
  legalLinkText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textDecorationLine: 'underline',
  },
  deleteBtn: {
    paddingVertical: spacing[3],
    alignItems: 'center',
    marginTop: spacing[2],
  },
  deleteText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
  achLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing[4],
  },
  achLinkText: {
    flex: 1,
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  achArrow: { fontSize: 22, color: colors.inkSoft, fontFamily: fontFamily.bodyBold },

  childrenSection: { gap: spacing[2] },
  childrenLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 11,
    color: colors.inkSoft,
    letterSpacing: 1,
  },
  childrenRow: { gap: spacing[2], paddingRight: spacing[5] },
  childPill: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minWidth: 130,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  childPillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  childPillName: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  childPillNameActive: { color: colors.primary },
  childPillMeta: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
  },
  childPillDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  childAddBtn: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  childAddPlus: {
    fontSize: 22,
    fontFamily: fontFamily.bodyBlack,
    color: colors.primary,
  },
  childAddText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
  },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: '#FFFBEA',
    borderWidth: 1.5,
    borderColor: '#FFD55A',
    borderRadius: radius.lg,
    padding: spacing[4],
  },
  verifyTitle: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.base,
    color: '#8B5E00',
  },
  verifySub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: '#A07000',
    marginTop: 2,
  },
});
