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
import { sendVerification, verifyEmail } from '@/services/api';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, gradients, radius, shadow, spacing } from '@/theme';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const userEmail = useSettings((s) => s.userEmail);
  const authToken = useSettings((s) => s.authToken);
  const isAz = lang === 'az';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleVerify = async () => {
    if (!authToken) {
      setError(isAz ? 'İcazə yoxdur' : 'Не авторизован');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError(isAz ? '6-rəqəmli kod' : '6-значный код');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await verifyEmail(authToken, code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSuccess(true);
      setTimeout(() => router.back(), 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(
        msg.includes('400')
          ? (isAz ? 'Yanlış və ya köhnə kod' : 'Неверный или просроченный код')
          : (isAz ? 'Xəta baş verdi' : 'Ошибка'),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!authToken) return;
    setResent(false);
    setError(null);
    try {
      await sendVerification(authToken);
      setResent(true);
      Haptics.selectionAsync().catch(() => {});
    } catch {
      setError(isAz ? 'Yenidən göndərmək alınmadı' : 'Не удалось отправить');
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
              ? (isAz ? '✓ Email təsdiqləndi' : '✓ Email подтверждён')
              : (isAz ? 'Email-i təsdiqlə' : 'Подтверди email')}
          </Text>
          <Text style={styles.subtitle}>
            {success
              ? (isAz ? 'Sağ ol!' : 'Спасибо!')
              : (isAz
                ? `${userEmail}-ə göndərilən 6-rəqəmli kodu daxil edin`
                : `Введите 6-значный код, отправленный на ${userEmail}`)}
          </Text>
        </Animated.View>

        {!success && (
          <Animated.View entering={FadeInUp.duration(500).delay(150)} style={styles.form}>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={colors.inkSoft}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
            {resent && !error && (
              <Text style={styles.successText}>
                {isAz ? '✓ Kod yenidən göndərildi' : '✓ Код отправлен повторно'}
              </Text>
            )}
            <Pressable
              onPress={handleVerify}
              disabled={loading || code.length !== 6}
              style={[styles.btn, (loading || code.length !== 6) && { opacity: 0.5 }]}
            >
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGrad}
              >
                <Text style={styles.btnText}>
                  {loading
                    ? (isAz ? 'Yoxlanılır...' : 'Проверяем...')
                    : (isAz ? 'Təsdiqlə' : 'Подтвердить')}
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={handleResend} style={{ paddingVertical: spacing[3], alignItems: 'center' }}>
              <Text style={{ color: colors.primary, fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm }}>
                {isAz ? 'Kodu yenidən göndər' : 'Отправить код снова'}
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
  form: { gap: spacing[3] },
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
    letterSpacing: 10,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.error,
    textAlign: 'center',
  },
  successText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.success,
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
