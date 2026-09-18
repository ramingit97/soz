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
import { sendVerification, verifyEmail } from '@/services/api';
import { useSettings } from '@/store/settings';
import { fontFamily, fontSize, spacing } from '@/theme';
import { MODE_TOKENS } from '@/theme/modeTokens';

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
    // Подтверждение почты — действие родителя: «взрослый» режим.
    <UIModeProvider force="teen">
      <PaperBackground>
        <ScreenHeader />
        <KeyboardAvoider contentContainerStyle={{ paddingHorizontal: MODE_TOKENS.teen.density.padX, paddingTop: spacing[4] }}>
          <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
            <HBPet size={72} mood={success ? 'happy' : 'curious'} />
            <Text variant="title" align="center">
              {success ? (isAz ? 'Email təsdiqləndi' : 'Email подтверждён') : isAz ? 'Email-i təsdiqləyin' : 'Подтвердите email'}
            </Text>
            <Text variant="body" tone="secondary" align="center">
              {success
                ? isAz ? 'Təşəkkürlər!' : 'Спасибо!'
                : isAz
                  ? `${userEmail} ünvanına göndərilən 6 rəqəmli kodu daxil edin.`
                  : `Введите 6-значный код из письма на ${userEmail}.`}
            </Text>
          </Animated.View>

          {success ? (
            <HBButton full iconRight="arrow-right" label={isAz ? 'Davam et' : 'Продолжить'} onPress={() => router.back()} />
          ) : (
            <Animated.View entering={FadeInUp.duration(450).delay(120)} style={styles.form}>
              <Field
                label={isAz ? 'Kod' : 'Код'}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                style={styles.code}
              />
              {error ? <InlineBanner tone="danger" text={error} /> : null}
              {resent && !error ? (
                <InlineBanner tone="success" text={isAz ? 'Kod yenidən göndərildi' : 'Код отправлен ещё раз'} />
              ) : null}
              <HBButton
                full
                icon="check"
                loading={loading}
                label={isAz ? 'Təsdiqlə' : 'Подтвердить'}
                onPress={handleVerify}
                disabled={loading || code.length !== 6}
              />
              <HBButton variant="ghost" icon="mail" label={isAz ? 'Kodu yenidən göndər' : 'Отправить код снова'} onPress={handleResend} />
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
