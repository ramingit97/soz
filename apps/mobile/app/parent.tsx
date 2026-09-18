import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBIconBox } from '@/components/HBIconBox';
import { HBPet } from '@/components/HBPet';
import { Icon, type IconName } from '@/components/Icon';
import { InlineBanner } from '@/components/InlineBanner';
import { PaperBackground } from '@/components/PaperBackground';
import { ParentalGateModal, useParentalGate } from '@/components/ParentalGate';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { useTheme } from '@/hooks/useTheme';
import { UIModeProvider } from '@/hooks/useUIMode';
import { deleteChild, getChildren, getMe, getTalkQuota, sendVerification, type ChildProfile, type TalkQuota } from '@/services/api';
import { fetchFullCurriculum } from '@/services/curriculum';
import { cancelAllReminders } from '@/services/notifications';
import { useSettings, todayISO } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, semantic, spacing, tints } from '@/theme';
import { MODE_TOKENS } from '@/theme/modeTokens';
import { useCompanionName } from '@/utils/companion';
import { LEVEL_INFO } from '@/utils/levels';

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
  const childLevel = useSettings((s) => s.childLevel);
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
  const accent = useAccent();
  // Сам экран лежит ВНЕ своего `UIModeProvider`, поэтому отступы берём из
  // взрослых токенов напрямую; внутренние компоненты режим уже видят.
  const padX = MODE_TOKENS.teen.density.padX;
  const weekActivity = buildWeekActivity(lastCompletedDate, streak);
  const dayLabels = isAz ? DAY_LABELS_AZ : DAY_LABELS_RU;
  const daysCompleted = Math.max(0, currentDay - 1);
  const vocabEstimate = daysCompleted * 5 * (learningLanguages.length || 1);
  // Языки словами, а не флагами: флаг страны — не язык, и на Android они разные.
  const learningLabel = learningLanguages
    .map((l) => (l === 'en' ? (isAz ? 'İngilis' : 'Английский') : (isAz ? 'Rus' : 'Русский')))
    .join(' · ');
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
    // Родительская зона всегда во «взрослом» режиме: её читает родитель, даже
    // если ребёнку шесть.
    <UIModeProvider force="teen">
      <PaperBackground>
        <ScreenHeader title={isAz ? 'Valideyn' : 'Родителям'} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingHorizontal: padX }]}>
          {/* Ребёнок */}
          <Animated.View entering={FadeInDown.duration(450)}>
            <HBCard style={styles.row}>
              <HBPet size={56} mood="happy" />
              <View style={styles.flex}>
                <Text variant="headline" numberOfLines={1}>{childName}</Text>
                {childAge ? (
                  <Text variant="caption" tone="secondary">
                    {isAz ? `${childAge} yaş` : `${childAge} лет`}
                    {learningLabel ? ` · ${learningLabel}` : ''}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.dayChip, { backgroundColor: accent.soft }]}>
                <Text style={[styles.dayChipText, { color: accent.ink }]}>
                  {isAz ? `Gün ${currentDay}/30` : `День ${currentDay}/30`}
                </Text>
              </View>
            </HBCard>
          </Animated.View>

          {/* Почта не подтверждена */}
          {emailVerified === false ? (
            <InlineBanner
              tone="warning"
              icon="mail"
              title={isAz ? 'Email-i təsdiqləyin' : 'Подтвердите email'}
              text={
                isAz
                  ? 'Bu, şifrəni bərpa etmək və təhlükəsizlik xəbərdarlıqlarını almaq üçün lazımdır.'
                  : 'Это нужно, чтобы восстановить пароль и получать предупреждения о безопасности.'
              }
              action={{ label: isAz ? 'Təsdiqlə' : 'Подтвердить', onPress: handleResendVerification }}
            />
          ) : null}

          {/* Дети */}
          {allChildren.length > 0 ? (
            <Animated.View entering={FadeInUp.duration(450).delay(60)} style={styles.block}>
              <Text variant="label" tone="secondary">{isAz ? 'Uşaqlar' : 'Дети'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.childrenRow}>
                {allChildren.map((c) => {
                  const active = c.id === childId;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => handleSwitchChild(c)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[
                        styles.childPill,
                        active && { backgroundColor: accent.soft, borderColor: accent.bottom },
                      ]}
                    >
                      <Text variant="bodyBold" numberOfLines={1} style={active ? { color: accent.ink } : undefined}>
                        {c.name}
                      </Text>
                      <View style={styles.pillMeta}>
                        <Text variant="caption" tone="secondary">
                          {isAz ? `Gün ${c.currentDay}` : `День ${c.currentDay}`}
                        </Text>
                        <Icon name="star" size={12} color={colors.butterDeep} fill={colors.butter} strokeWidth={2} />
                        <Text variant="caption" tone="secondary">{c.totalStars}</Text>
                      </View>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => router.push('/setup/profile-type' as never)}
                  accessibilityRole="button"
                  style={[styles.childPill, styles.childAdd]}
                >
                  <Icon name="plus" size={20} color={colors.inkSoft} />
                  <Text variant="caption" tone="secondary">{isAz ? 'Əlavə et' : 'Добавить'}</Text>
                </Pressable>
              </ScrollView>
            </Animated.View>
          ) : null}

          {/* Разделы */}
          <Animated.View entering={FadeInUp.duration(450).delay(100)} style={styles.block}>
            <LinkRow
              icon="trophy"
              label={isAz ? 'Nailiyyətlər' : 'Достижения'}
              onPress={() => router.push('/achievements' as any)}
            />
            <LinkRow
              icon="messages-square"
              label={isAz ? 'Dialoqlar' : `Диалоги ${childName}`}
              onPress={() => router.push('/parent-transcripts' as any)}
            />
            <LinkRow
              icon="sliders-horizontal"
              label={isAz ? 'Dərsləri tənzimlə' : 'Настроить уроки'}
              onPress={() => router.push('/checkpoint' as any)}
            />
            <LinkRow
              icon="target"
              label={isAz ? 'Məqsədlər və vurğu' : 'Цели и упор'}
              onPress={() => router.push('/setup/goals?from=parent' as never)}
            />
            <LinkRow
              icon="graduation-cap"
              label={`${isAz ? 'Dil səviyyəsi' : 'Уровень языка'} · ${LEVEL_INFO[childLevel ?? 'beginner'].code}`}
              onPress={() => router.push('/setup/level' as never)}
            />
          </Animated.View>

          {/* Отчёт — всегда: пройденные уроки и память персонажа видны с первого дня,
              разбор ИИ появляется позже. */}
          <Animated.View entering={FadeInUp.duration(450).delay(140)}>
            <Pressable onPress={() => router.push('/parent-summary' as any)} accessibilityRole="button">
              <HBCard bg={accent.soft} style={styles.row}>
                <HBIconBox icon="brain" tint={colors.surface} iconColor={accent.ink} size={44} />
                <View style={styles.flex}>
                  <Text variant="bodyBold">{isAz ? 'Hesabat və plan' : 'Отчёт и план'}</Text>
                  <Text variant="caption" style={{ color: colors.ink }}>
                    {currentDay >= 8
                      ? isAz ? `${bot} tərəqqini təhlil etdi` : `${bot} разобрал прогресс`
                      : isAz ? `Keçilən dərslər və ${bot} yaddaşı` : `Пройденные уроки и память ${bot}`}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={accent.ink} />
              </HBCard>
            </Pressable>
          </Animated.View>

          {/* Цифры */}
          <Animated.View entering={FadeInUp.duration(450).delay(180)} style={styles.statsRow}>
            <Stat icon="flame" color={colors.primaryDeep} value={streak} label={isAz ? 'Seriya' : 'Серия'} />
            <Stat icon="star" color={colors.butterDeep} fill={colors.butter} value={totalStars} label={isAz ? 'Ulduz' : 'Звёзд'} />
            <Stat icon="book-open" color={colors.accentDeep} value={vocabEstimate} label={isAz ? 'Söz' : 'Слов'} />
          </Animated.View>

          {/* Неделя */}
          <Animated.View entering={FadeInUp.duration(450).delay(220)}>
            <HBCard style={styles.block}>
              <View style={styles.sectionHead}>
                <Text variant="bodyBold" style={styles.flex}>
                  {isAz ? '7 günlük aktivlik' : '7 дней активности'}
                </Text>
                <Text variant="caption" tone="secondary">
                  {weeklyActive}/{weekActivity.length} {isAz ? 'gün' : 'дн'}
                </Text>
              </View>
              <View style={styles.calendarRow}>
                {weekActivity.map((day) => (
                  <View key={day.iso} style={styles.calDay}>
                    <Text variant="caption" tone={day.isToday ? 'primary' : 'secondary'}>
                      {dayLabels[day.dow]}
                    </Text>
                    <View
                      style={[
                        styles.calDot,
                        day.completed && { backgroundColor: accent.bottom, borderColor: accent.bottom },
                        day.isToday && !day.completed && { borderColor: accent.bottom },
                      ]}
                    >
                      {day.completed ? <Icon name="check" size={14} color={accent.text} strokeWidth={3} /> : null}
                    </View>
                  </View>
                ))}
              </View>
              {streak > 0 ? (
                <Text variant="caption" tone="secondary">
                  {isAz
                    ? `Seriya davam edir: ${streak} gün`
                    : `Серия уже ${streak} ${streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'}`}
                </Text>
              ) : null}
            </HBCard>
          </Animated.View>

          {/* Расписание */}
          <Animated.View entering={FadeInUp.duration(450).delay(260)}>
            <HBCard style={styles.block}>
              <View style={styles.sectionHead}>
                <Text variant="bodyBold" style={styles.flex}>{isAz ? 'Cədvəl' : 'Расписание'}</Text>
                <HBButton
                  size="sm"
                  variant="ghost"
                  icon="pencil"
                  label={isAz ? 'Dəyişdir' : 'Изменить'}
                  onPress={() => router.push('/setup/schedule?from=parent' as never)}
                />
              </View>
              <View style={styles.chipsRow}>
                {scheduleDays.map((d) => (
                  <View key={d} style={styles.chip}>
                    <Text variant="caption">{SCHEDULE_DAY_SHORT[d] ?? d}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.chipsRow}>
                <View style={styles.chip}>
                  <Icon name="clock" size={14} color={colors.inkSoft} />
                  <Text variant="caption">{scheduleTimeStr}</Text>
                </View>
                <View style={styles.chip}>
                  <Icon name="target" size={14} color={colors.inkSoft} />
                  <Text variant="caption">{scheduleMinutes} {isAz ? 'dəq' : 'мин'}</Text>
                </View>
              </View>
            </HBCard>
          </Animated.View>

          {/* Аккаунт */}
          <Animated.View entering={FadeInUp.duration(450).delay(300)}>
            <HBCard style={styles.block}>
              <Text variant="bodyBold">{isAz ? 'Hesab' : 'Аккаунт'}</Text>
              {userEmail ? (
                <Text variant="caption" tone="secondary">{userEmail}</Text>
              ) : null}

              {isPremium ? (
                <View style={[styles.premiumRow, { backgroundColor: tints.butter }]}>
                  <Icon name="crown" size={18} color={colors.butterDeep} fill={colors.butter} strokeWidth={2} />
                  <Text variant="bodyBold" style={{ color: '#7F6628' }}>
                    {isAz ? 'Söz Premium aktivdir' : 'Söz Premium активен'}
                  </Text>
                </View>
              ) : (
                <>
                  {quota && !quota.premium ? (
                    <Text variant="caption" tone="secondary">
                      {isAz
                        ? `Bu gün ${quota.remaining} / ${quota.limit} söhbət qalıb`
                        : `Разговоров сегодня осталось ${quota.remaining} из ${quota.limit}`}
                    </Text>
                  ) : null}
                  <HBButton
                    full
                    icon="crown"
                    label={isAz ? 'Premium — bütün 30 gün' : 'Premium — все 30 дней'}
                    onPress={() => parentalGate.run(() => router.push('/paywall' as any))}
                  />
                </>
              )}

              <View style={styles.accountLinks}>
                <TextLink
                  icon="shield-check"
                  label={isAz ? 'Məxfilik siyasəti' : 'Политика конфиденциальности'}
                  onPress={() => router.push('/legal/privacy' as any)}
                />
                <TextLink icon="log-out" label={isAz ? 'Çıxış' : 'Выйти из аккаунта'} onPress={handleLogout} />
                <TextLink
                  icon="trash"
                  danger
                  label={isAz ? `${childName} profilini sil` : `Удалить профиль ${childName}`}
                  onPress={handleDeleteChild}
                />
              </View>
            </HBCard>
          </Animated.View>
        </ScrollView>

        <ParentalGateModal {...parentalGate.modalProps} />
      </PaperBackground>
    </UIModeProvider>
  );
}

function LinkRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { accent } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <HBCard style={styles.row}>
        <HBIconBox icon={icon} tint={accent.soft} iconColor={accent.ink} size={40} />
        <Text variant="bodyBold" style={styles.flex} numberOfLines={1}>
          {label}
        </Text>
        <Icon name="chevron-right" size={20} color={colors.inkSoft} />
      </HBCard>
    </Pressable>
  );
}

function Stat({
  icon,
  color,
  fill,
  value,
  label,
}: {
  icon: IconName;
  color: string;
  fill?: string;
  value: number;
  label: string;
}) {
  return (
    <HBCard style={styles.statCard}>
      <Icon name={icon} size={20} color={color} fill={fill} strokeWidth={2.25} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text variant="caption" tone="secondary">{label}</Text>
    </HBCard>
  );
}

function TextLink({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const color = danger ? semantic.danger : colors.inkSoft;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.textLink} hitSlop={6}>
      <Icon name={icon} size={16} color={color} />
      <Text variant="caption" style={{ color }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: spacing[2], paddingBottom: spacing[10], gap: spacing[3] },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1, minWidth: 0 },
  block: { gap: spacing[2] },

  dayChip: { paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.full },
  dayChipText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize['2xs'] },

  childrenRow: { gap: spacing[2], paddingVertical: 2 },
  childPill: {
    minWidth: 116,
    gap: 2,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  pillMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  childAdd: { minWidth: 96, alignItems: 'center', justifyContent: 'center' },

  statsRow: { flexDirection: 'row', gap: spacing[2] },
  statCard: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing[3] },
  statValue: { fontFamily: fontFamily.display, fontSize: fontSize.xl },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  calendarRow: { flexDirection: 'row', justifyContent: 'space-between' },
  calDay: { alignItems: 'center', gap: 4 },
  calDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },

  premiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
  },
  accountLinks: { gap: spacing[2], marginTop: spacing[1] },
  textLink: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 2 },
});
