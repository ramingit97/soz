import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { createChild, registerUser } from '@/services/api';
import { clearGuestSession } from '@/services/guestSession';
import { fetchFullCurriculum } from '@/services/curriculum';
import { focusToLessonPrefs, useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing } from '@/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const storedHue = useSettings((s) => s.petHue);
  const petName = useSettings((s) => s.petName);
  const childName = useSettings((s) => s.childName) ?? '';
  const childAge = useSettings((s) => s.childAge) ?? 8;
  const childAgeBand = useSettings((s) => s.childAgeBand);
  const childLevel = useSettings((s) => s.childLevel) ?? 'beginner';
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const scheduleDays = useSettings((s) => s.scheduleDays);
  const scheduleMinutes = useSettings((s) => s.scheduleMinutes);
  const scheduleHour = useSettings((s) => s.scheduleHour);
  const setAuth = useSettings((s) => s.setAuth);
  const setChildId = useSettings((s) => s.setChildId);
  const childInterests = useSettings((s) => s.childInterests);
  const learningFocus = useSettings((s) => s.learningFocus);
  const completeOnboarding = useSettings((s) => s.completeOnboarding);
  const existingAuthToken = useSettings((s) => s.authToken);
  const isGuestAccount = useSettings((s) => s.isGuestAccount);
  const existingChildId = useSettings((s) => s.childId);
  const profileType = useSettings((s) => s.profileType);
  const goal = useSettings((s) => s.goal);
  const proactiveOptIn = useSettings((s) => s.proactiveOptIn);
  const isAdult = profileType === 'adult';
  const isAz = lang === 'az';

  // A REGISTERED user landing here would orphan their children under a second
  // account, so bounce them home. A guest must NOT be bounced: they hold a real
  // token too, and this screen is exactly how they convert — the sign-up upgrades
  // their existing account rather than creating a new one.
  useEffect(() => {
    if (existingAuthToken && !isGuestAccount) {
      router.replace('/home');
    }
  }, [existingAuthToken, isGuestAccount, router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const pwRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const handleRegister = async () => {
    const trimEmail = email.trim().toLowerCase();
    if (!trimEmail || !password) {
      setError(isAz ? 'Email və şifrə daxil edin' : 'Введите email и пароль');
      return;
    }
    if (!trimEmail.includes('@')) {
      setError(isAz ? 'Düzgün email daxil edin' : 'Введите корректный email');
      return;
    }
    if (password.length < 6) {
      setError(isAz ? 'Şifrə ən az 6 simvol olmalıdır' : 'Пароль должен быть не менее 6 символов');
      return;
    }
    if (password !== confirmPassword) {
      setError(isAz ? 'Şifrələr uyğun gəlmir' : 'Пароли не совпадают');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // Sending the guest token upgrades that trial account in place, keeping the
      // same userId — so the child profile, day-1 progress and memory built during
      // the trial carry over instead of being orphaned under a fresh account.
      const guestToken = isGuestAccount ? existingAuthToken : null;
      const auth = await registerUser(trimEmail, password, guestToken);
      if (!auth?.token || !auth?.user?.id) {
        throw new Error('Invalid registration response');
      }
      setAuth(auth.token, auth.user.id, auth.user.email, false);
      await clearGuestSession();

      // The trial already created the child under this same account — creating
      // another here would leave the parent with a duplicate profile.
      if (guestToken && existingChildId) {
        completeOnboarding();
        for (const learnLang of (learningLanguages.length > 0 ? learningLanguages : ['en'])) {
          fetchFullCurriculum(existingChildId, learnLang, auth.token).catch(() => {});
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.replace('/setup/notify' as any);
        return;
      }

      const child = await createChild(
        {
          name: childName || (isAz ? 'Uşaq' : 'Ребёнок'),
          age: childAge,
          ageBand: childAgeBand ?? undefined,
          petName: petName ?? undefined,
          level: childLevel,
          learningLanguages: learningLanguages.length > 0 ? learningLanguages : ['en'],
          interests: childInterests.length > 0 ? childInterests : undefined,
          lessonPrefs: learningFocus.length > 0 ? focusToLessonPrefs(learningFocus) : undefined,
          scheduleDays,
          scheduleMinutes,
          scheduleHour,
          profileType,
          goal: goal ?? undefined,
          proactiveOptIn: proactiveOptIn ? 1 : 0,
        },
        auth.token,
      );

      setChildId(child.id);
      completeOnboarding();

      for (const learnLang of (learningLanguages.length > 0 ? learningLanguages : ['en'])) {
        fetchFullCurriculum(child.id, learnLang, auth.token).catch(() => {});
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Explicit notification priming → plan selection → home.
      router.replace('/setup/notify' as any);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.toLowerCase() : '';
      if (msg.includes('409') || msg.includes('already') || msg.includes('exists') || msg.includes('taken')) {
        setError(isAz ? 'Bu email artıq qeydiyyatdadır' : 'Этот email уже зарегистрирован');
      } else if (msg.includes('network') || msg.includes('failed to fetch')) {
        setError(isAz ? 'İnternet əlaqəsi yoxdur' : 'Нет соединения с интернетом');
      } else if (msg.includes('password')) {
        setError(isAz ? 'Şifrə zəifdir' : 'Пароль слишком простой');
      } else {
        setError(isAz ? 'Xəta baş verdi. Yenidən cəhd edin' : 'Ошибка. Попробуйте снова');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PaperBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
            <View style={styles.petHalo}>
              <HBPet size={72} hue={storedHue} mood="happy" />
            </View>
            <Text style={styles.title}>
              {childName
                ? (isAz ? `${childName} üçün hesab` : `Аккаунт для ${childName}`)
                : (isAz ? 'Hesab yaradın' : 'Создайте аккаунт')}
            </Text>
            <Text style={styles.subtitle}>
              {isAz
                ? 'Tərəqqinizi saxlamaq üçün qeydiyyatdan keçin'
                : 'Зарегистрируйтесь, чтобы сохранить прогресс'}
            </Text>
          </Animated.View>

          {/* Tab bar */}
          <Animated.View entering={FadeInUp.duration(500).delay(100)} style={styles.tabs}>
            <Pressable
              style={styles.tabInactive}
              onPress={() => router.replace('/auth/login' as any)}
            >
              <Text style={styles.tabTextInactive}>
                {isAz ? 'Daxil ol' : 'Войти'}
              </Text>
            </Pressable>
            <View style={styles.tabActive}>
              <Text style={styles.tabTextActive}>
                {isAz ? 'Qeydiyyat' : 'Создать'}
              </Text>
            </View>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInUp.duration(500).delay(180)} style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>
                {isAdult
                  ? 'Email'
                  : isAz ? 'Valideyn emaili' : 'Email родителя'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="email@example.com"
                placeholderTextColor={colors.inkSoft}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => pwRef.current?.focus()}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{isAz ? 'Şifrə' : 'Пароль'}</Text>
              <TextInput
                ref={pwRef}
                style={styles.input}
                placeholder={isAz ? 'Ən az 6 simvol' : 'Минимум 6 символов'}
                placeholderTextColor={colors.inkSoft}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                {isAz ? 'Şifrəni təsdiqləyin' : 'Подтвердите пароль'}
              </Text>
              <TextInput
                ref={confirmRef}
                style={styles.input}
                placeholder={isAz ? 'Şifrəni yenidən daxil edin' : 'Повторите пароль'}
                placeholderTextColor={colors.inkSoft}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <HBButton
              full
              variant="primary"
              label={loading
                ? (isAz ? 'Yüklənir...' : 'Загрузка...')
                : (isAz ? 'Başla 🚀' : 'Начать 🚀')}
              onPress={handleRegister}
              disabled={loading}
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{isAz ? 'və ya' : 'или'}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social placeholders */}
            <View style={styles.socialRow}>
              <SocialBtn icon="🍎" label="Apple" />
              <SocialBtn icon="G" label="Google" />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(400).delay(280)} style={styles.footer}>
            <Pressable onPress={() => router.replace('/auth/login' as any)}>
              <Text style={styles.footerText}>
                {isAz ? 'Hesabınız var? ' : 'Уже есть аккаунт? '}
                <Text style={styles.footerLink}>
                  {isAz ? 'Daxil olun' : 'Войдите'}
                </Text>
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </PaperBackground>
  );
}

function SocialBtn({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.socialBtn}>
      <Text style={styles.socialIcon}>{icon}</Text>
      <Text style={styles.socialLabel}>{label}</Text>
      <View style={styles.soonBadge}>
        <Text style={styles.soonText}>Скоро</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing[6],
    paddingTop: 60,
    paddingBottom: spacing[8],
  },

  header: { alignItems: 'center', marginBottom: spacing[6], gap: spacing[2] },
  petHalo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
    ...shadow.sm,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.bgDeep,
    borderRadius: radius.xl,
    padding: 4,
    marginBottom: spacing[6],
  },
  tabActive: {
    flex: 1,
    paddingVertical: spacing[3],
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
    ...shadow.sm,
  },
  tabInactive: {
    flex: 1,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  tabTextActive: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  tabTextInactive: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },

  form: { gap: spacing[4] },
  field: { gap: spacing[2] },
  label: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
  input: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.10)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: 'rgba(125,90,42,0.06)',
    borderRightColor: 'rgba(125,90,42,0.06)',
    borderRadius: radius.xl,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.ink,
    ...shadow.sm,
  },

  errorBox: {
    backgroundColor: '#FFF0F0',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.lg,
    padding: spacing[3],
  },
  errorText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.error,
    textAlign: 'center',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginVertical: spacing[1],
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.bgDeep },
  dividerText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },

  socialRow: { flexDirection: 'row', gap: spacing[3] },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
    opacity: 0.7,
    position: 'relative',
    ...shadow.sm,
  },
  socialIcon: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  socialLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  soonBadge: {
    position: 'absolute',
    top: -8,
    right: -4,
    backgroundColor: colors.butter,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  soonText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: scaleFont(9),
    color: colors.ink,
    letterSpacing: 0.2,
  },

  footer: { alignItems: 'center', marginTop: spacing[6] },
  footerText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
  footerLink: {
    fontFamily: fontFamily.bodyBold,
    color: colors.primary,
  },
});
