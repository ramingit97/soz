import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Bobo } from '@/components/Bobo';
import { HBBackButton } from '@/components/HBBackButton';
import { KeyboardAvoider } from '@/components/KeyboardAvoider';
import { Text } from '@/components/Text';
import { forgotPassword, resetPassword } from '@/services/api';
import { useSettings } from '@/store/settings';
import { colors, gradients, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

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
    <View style={styles.root}>
      <LinearGradient
        colors={['#F7F0FF', '#EFE8FF', '#FFF6EC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <HBBackButton />

      <KeyboardAvoider center contentContainerStyle={{ paddingHorizontal: spacing[5] }}>
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
          <Bobo size={88} mood={success ? 'happy' : 'curious'} />
          <Text style={styles.title}>
            {success
              ? (isAz ? '✓ Şifrə dəyişdirildi' : '✓ Пароль изменён')
              : step === 'email'
              ? (isAz ? 'Şifrəni unutdum' : 'Забыл пароль')
              : (isAz ? 'Yeni şifrə qur' : 'Новый пароль')}
          </Text>
          <Text style={styles.subtitle}>
            {success
              ? (isAz ? 'Daxil ola bilərsiz' : 'Можете войти')
              : step === 'email'
              ? (isAz ? 'Email-ə kod göndərəcəyik' : 'Отправим код на email')
              : (isAz
                ? `${email}-ə göndərilən 6-rəqəmli kodu daxil edin`
                : `Введите 6-значный код, отправленный на ${email}`)}
          </Text>
        </Animated.View>

        {!success && step === 'email' && (
          <Animated.View entering={FadeInUp.duration(500).delay(150)} style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                placeholderTextColor={colors.inkSoft}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <Pressable
              onPress={handleRequest}
              disabled={loading}
              style={[styles.btn, loading && { opacity: 0.6 }]}
            >
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGrad}
              >
                <Text style={styles.btnText}>
                  {loading
                    ? (isAz ? 'Göndərilir...' : 'Отправляем...')
                    : (isAz ? 'Kod göndər →' : 'Отправить код →')}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {!success && step === 'reset' && (
          <Animated.View entering={FadeInUp.duration(500)} style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>{isAz ? 'Kod' : 'Код'}</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor={colors.inkSoft}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>{isAz ? 'Yeni şifrə' : 'Новый пароль'}</Text>
              <TextInput
                style={styles.input}
                value={newPwd}
                onChangeText={setNewPwd}
                placeholder={isAz ? 'Ən az 6 simvol' : 'Минимум 6 символов'}
                placeholderTextColor={colors.inkSoft}
                secureTextEntry
                autoComplete="new-password"
              />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <Pressable
              onPress={handleReset}
              disabled={loading}
              style={[styles.btn, loading && { opacity: 0.6 }]}
            >
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGrad}
              >
                <Text style={styles.btnText}>
                  {loading
                    ? (isAz ? 'Yenilənir...' : 'Сохраняем...')
                    : (isAz ? 'Şifrəni dəyişdir' : 'Сменить пароль')}
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => setStep('email')} style={{ paddingVertical: spacing[2], alignItems: 'center' }}>
              <Text style={{ color: colors.inkSoft, fontFamily: fontFamily.bodyMedium, fontSize: 14 }}>
                {isAz ? 'Email-i dəyişdir' : 'Изменить email'}
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </KeyboardAvoider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kav: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing[5] },
  header: { alignItems: 'center', gap: spacing[2], marginBottom: spacing[6] },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  subtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },
  form: { gap: spacing[4] },
  field: { gap: spacing[2] },
  label: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.ink,
    ...shadow.sm,
  },
  codeInput: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    letterSpacing: 8,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.error,
    textAlign: 'center',
  },
  btn: { borderRadius: radius.full, overflow: 'hidden', ...shadow.glow },
  btnGrad: { paddingVertical: spacing[4], alignItems: 'center' },
  btnText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.lg,
  },
});
