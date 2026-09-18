import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { AuthTabs } from '@/components/AuthTabs';
import { Field } from '@/components/Field';
import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { InlineBanner } from '@/components/InlineBanner';
import { PaperBackground } from '@/components/PaperBackground';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { UIModeProvider } from '@/hooks/useUIMode';
import { createChild, registerUser } from '@/services/api';
import { clearGuestSession } from '@/services/guestSession';
import { fetchFullCurriculum } from '@/services/curriculum';
import { focusToLessonPrefs, useSettings } from '@/store/settings';
import { spacing } from '@/theme';
import { MODE_TOKENS } from '@/theme/modeTokens';

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
        router.replace('/home');
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
      router.replace('/home');
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
    // Регистрация — действие родителя: «взрослый» режим.
    <UIModeProvider force="teen">
      <PaperBackground>
        <ScreenHeader hideBack={!router.canGoBack()} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scroll, { paddingHorizontal: MODE_TOKENS.teen.density.padX }]}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
              <HBPet size={72} hue={storedHue} mood="happy" />
              <Text variant="title" align="center">
                {childName
                  ? isAz ? `${childName} üçün hesab` : `Аккаунт для ${childName}`
                  : isAz ? 'Hesab yaradın' : 'Создайте аккаунт'}
              </Text>
              <Text variant="body" tone="secondary" align="center">
                {isAz ? 'Tərəqqini saxlamaq üçün qeydiyyatdan keçin' : 'Зарегистрируйтесь, чтобы сохранить прогресс'}
              </Text>
            </Animated.View>

            <AuthTabs active="register" az={isAz} />

            <Animated.View entering={FadeInUp.duration(450).delay(120)} style={styles.form}>
              <Field
                label={isAdult ? 'Email' : isAz ? 'Valideynin emaili' : 'Email родителя'}
                placeholder="email@example.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => pwRef.current?.focus()}
              />
              <Field
                ref={pwRef}
                label={isAz ? 'Şifrə' : 'Пароль'}
                placeholder={isAz ? 'Ən az 6 simvol' : 'Минимум 6 символов'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
              <Field
                ref={confirmRef}
                label={isAz ? 'Şifrəni təkrarlayın' : 'Повторите пароль'}
                placeholder={isAz ? 'Şifrəni yenidən daxil edin' : 'Ещё раз тот же пароль'}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />

              {error ? <InlineBanner tone="danger" text={error} onClose={() => setError('')} /> : null}

              <HBButton
                full
                iconRight="arrow-right"
                loading={loading}
                label={isAz ? 'Hesab yarat' : 'Создать аккаунт'}
                onPress={handleRegister}
                disabled={loading}
              />
            </Animated.View>

          </ScrollView>
        </KeyboardAvoidingView>
      </PaperBackground>
    </UIModeProvider>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  scroll: { paddingTop: spacing[1], paddingBottom: spacing[10], gap: spacing[5] },
  header: { alignItems: 'center', gap: spacing[2] },
  form: { gap: spacing[4] },
});
