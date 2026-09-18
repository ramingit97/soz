import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Field } from '@/components/Field';
import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { InlineBanner } from '@/components/InlineBanner';
import { KeyboardAvoider } from '@/components/KeyboardAvoider';
import { PaperBackground } from '@/components/PaperBackground';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { UIModeProvider } from '@/hooks/useUIMode';
import { forgotPassword, resetPassword } from '@/services/api';
import { useSettings } from '@/store/settings';
import { fontFamily, fontSize, spacing } from '@/theme';
import { MODE_TOKENS } from '@/theme/modeTokens';

type Step = 'email' | 'reset';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const isAz = lang === 'az';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRequest = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError(isAz ? 'Düzgün email daxil edin' : 'Введите корректный email');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStep('reset');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError(isAz ? '6-rəqəmli kod' : '6-значный код');
      return;
    }
    if (newPwd.length < 6) {
      setError(isAz ? 'Şifrə ən az 6 simvol' : 'Пароль минимум 6 символов');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email.trim().toLowerCase(), code, newPwd);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSuccess(true);
      setTimeout(() => router.replace('/auth/login' as any), 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('400')) {
        setError(isAz ? 'Yanlış və ya köhnə kod' : 'Неверный или просроченный код');
      } else {
        setError(isAz ? 'Xəta baş verdi' : 'Ошибка');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    // Восстановление пароля — действие родителя: «взрослый» режим.
    <UIModeProvider force="teen">
      <PaperBackground>
        <ScreenHeader />
        <KeyboardAvoider contentContainerStyle={{ paddingHorizontal: MODE_TOKENS.teen.density.padX, paddingTop: spacing[4] }}>
          <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
            <HBPet size={72} mood={success ? 'happy' : 'curious'} />
            <Text variant="title" align="center">
              {success
                ? isAz ? 'Şifrə dəyişdirildi' : 'Пароль изменён'
                : step === 'email'
                  ? isAz ? 'Şifrəni unutmusunuz?' : 'Забыли пароль?'
                  : isAz ? 'Yeni şifrə' : 'Новый пароль'}
            </Text>
            <Text variant="body" tone="secondary" align="center">
              {success
                ? isAz ? 'İndi yeni şifrə ilə daxil ola bilərsiniz.' : 'Теперь можно войти с новым паролем.'
                : step === 'email'
                  ? isAz ? 'Email-ə kod göndərəcəyik.' : 'Отправим код на email.'
                  : isAz
                    ? `${email} ünvanına göndərilən 6 rəqəmli kodu daxil edin.`
                    : `Введите 6-значный код из письма на ${email}.`}
            </Text>
          </Animated.View>

          {success ? (
            <HBButton full iconRight="arrow-right" label={isAz ? 'Daxil ol' : 'Войти'} onPress={() => router.replace('/auth/login' as never)} />
          ) : step === 'email' ? (
            <Animated.View entering={FadeInUp.duration(450).delay(120)} style={styles.form}>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              {error ? <InlineBanner tone="danger" text={error} /> : null}
              <HBButton
                full
                icon="mail"
                loading={loading}
                label={isAz ? 'Kod göndər' : 'Отправить код'}
                onPress={handleRequest}
                disabled={loading}
              />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInUp.duration(450)} style={styles.form}>
              <Field
                label={isAz ? 'Kod' : 'Код'}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                style={styles.code}
              />
              <Field
                label={isAz ? 'Yeni şifrə' : 'Новый пароль'}
                value={newPwd}
                onChangeText={setNewPwd}
                placeholder={isAz ? 'Ən az 6 simvol' : 'Минимум 6 символов'}
                secureTextEntry
                autoComplete="new-password"
              />
              {error ? <InlineBanner tone="danger" text={error} /> : null}
              <HBButton
                full
                icon="check"
                loading={loading}
                label={isAz ? 'Şifrəni dəyiş' : 'Сменить пароль'}
                onPress={handleReset}
                disabled={loading}
              />
              <HBButton variant="ghost" label={isAz ? 'Email-i dəyiş' : 'Изменить email'} onPress={() => setStep('email')} />
            </Animated.View>
          )}
        </KeyboardAvoider>
      </PaperBackground>
    </UIModeProvider>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing[2], marginBottom: spacing[5] },
  form: { gap: spacing[4] },
  code: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.xl, letterSpacing: 8, textAlign: 'center' },
});
