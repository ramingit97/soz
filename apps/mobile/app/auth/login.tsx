import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
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

import { AuthTabs } from '@/components/AuthTabs';
import { Field } from '@/components/Field';
import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { InlineBanner } from '@/components/InlineBanner';
import { PaperBackground } from '@/components/PaperBackground';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { UIModeProvider } from '@/hooks/useUIMode';
import { getChildren, loginUser } from '@/services/api';
import { fetchFullCurriculum } from '@/services/curriculum';
import { useSettings } from '@/store/settings';
import { spacing } from '@/theme';
import { MODE_TOKENS } from '@/theme/modeTokens';

export default function LoginScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const storedHue = useSettings((s) => s.petHue);
  const setAuth = useSettings((s) => s.setAuth);
  const syncChild = useSettings((s) => s.syncChild);
  const isAz = lang === 'az';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const pwRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError(isAz ? 'Email və şifrə daxil edin' : 'Введите email и пароль');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await loginUser(email.trim().toLowerCase(), password);
      setAuth(res.token, res.user.id, res.user.email);

      const children = await getChildren(res.token);
      if (children.length > 0 && children[0]) {
        syncChild(children[0]);
        for (const learnLang of children[0].learningLanguages) {
          fetchFullCurriculum(children[0].id, learnLang, res.token).catch(() => {});
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/home');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('401')) {
        setError(isAz ? 'Yanlış email və ya şifrə' : 'Неверный email или пароль');
      } else {
        setError(isAz ? 'Xəta baş verdi. Yenidən cəhd edin' : 'Ошибка. Попробуйте снова');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    // Вход — действие родителя: «взрослый» режим.
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
              <Text variant="title" align="center">{isAz ? 'Xoş gəldiniz!' : 'С возвращением!'}</Text>
              <Text variant="body" tone="secondary" align="center">
                {isAz ? 'Hesabınıza daxil olun' : 'Войдите в свой аккаунт'}
              </Text>
            </Animated.View>

            <AuthTabs active="login" az={isAz} />

            <Animated.View entering={FadeInUp.duration(450).delay(120)} style={styles.form}>
              <Field
                label="Email"
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
                labelRight={
                  <Pressable onPress={() => router.push('/auth/forgot' as any)} hitSlop={8} accessibilityRole="link">
                    <Text variant="caption" tone="brand">{isAz ? 'Unutmusunuz?' : 'Забыли?'}</Text>
                  </Pressable>
                }
                placeholder={isAz ? 'Şifrənizi daxil edin' : 'Введите пароль'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              {error ? <InlineBanner tone="danger" text={error} onClose={() => setError('')} /> : null}

              <HBButton
                full
                iconRight="arrow-right"
                loading={loading}
                label={isAz ? 'Daxil ol' : 'Войти'}
                onPress={handleLogin}
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
