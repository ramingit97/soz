import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Bobo } from '@/components/Bobo';
import { HBBackButton } from '@/components/HBBackButton';
import { Text } from '@/components/Text';
import { setPin as savePin } from '@/services/parentPin';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

/**
 * Parental gate before registration. Required for COPPA (US <13) and GDPR-K (EU <16).
 * The parent sets a 4-digit PIN here (an adult action) which then guards every
 * parent-only area later. Replaces the old math challenge.
 */
export default function ConsentScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childAge = useSettings((s) => s.childAge);
  const isAz = lang === 'az';

  const [step, setStep] = useState<'gate' | 'consent'>('gate');
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create');
  const [pin, setPinDigits] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState({ data: false, audio: false, age: false });

  const handleNumber = (n: number) => {
    if (pin.length >= 4) return;
    Haptics.selectionAsync().catch(() => {});
    setError(null);
    setPinDigits((prev) => prev + String(n));
  };

  const handleBackspace = () => {
    setError(null);
    setPinDigits((prev) => prev.slice(0, -1));
  };

  // Auto-advance when 4 digits are entered.
  useEffect(() => {
    if (pin.length < 4) return;
    const t = setTimeout(async () => {
      if (pinStep === 'create') {
        setFirstPin(pin);
        setPinDigits('');
        setPinStep('confirm');
      } else {
        if (pin === firstPin) {
          await savePin(pin);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setError(null);
          setStep('consent');
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          setError(isAz ? 'Kodlar uyğun gəlmədi. Yenidən.' : 'Коды не совпали. Ещё раз.');
          setFirstPin('');
          setPinDigits('');
          setPinStep('create');
        }
      }
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const allAgreed = agreed.data && agreed.audio && agreed.age;

  const setAudioConsent = useSettings((s) => s.setAudioConsent);

  const handleProceed = () => {
    if (!allAgreed) return;
    // Persist the audio-consent decision — the mic is gated on it (COPPA / Families).
    setAudioConsent(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.replace('/auth/register' as any);
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

      <ScrollView contentContainerStyle={styles.scroll}>
        {step === 'gate' ? (
          <>
            <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
              <Bobo size={88} mood="curious" />
              <Text style={styles.title}>
                {pinStep === 'create'
                  ? isAz ? 'Valideyn kodu yaradın' : 'Придумайте код для родителей'
                  : isAz ? 'Kodu təkrarlayın' : 'Повторите код'}
              </Text>
              <Text style={styles.subtitle}>
                {pinStep === 'create'
                  ? isAz
                    ? '4 rəqəm — yalnız siz biləcəksiniz. Valideyn bölməsinə giriş üçündür.'
                    : '4 цифры — будете знать только вы. Нужен для входа в раздел родителя.'
                  : isAz ? 'Yadda saxlamaq üçün bir də daxil edin' : 'Введите ещё раз, чтобы запомнить'}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(500).delay(150)} style={[styles.gateCard, shadow.md]}>
              <View style={styles.dots}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
                ))}
              </View>
              {error && (
                <Animated.View entering={FadeIn.duration(200)}>
                  <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
              )}
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(500).delay(300)} style={styles.numpad}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <Pressable key={n} onPress={() => handleNumber(n)} style={[styles.numKey, shadow.sm]}>
                  <Text style={styles.numText}>{n}</Text>
                </Pressable>
              ))}
              <View style={styles.numKeyGhost} />
              <Pressable onPress={() => handleNumber(0)} style={[styles.numKey, shadow.sm]}>
                <Text style={styles.numText}>0</Text>
              </Pressable>
              <Pressable onPress={handleBackspace} style={[styles.numKey, styles.backKey]}>
                <Text style={styles.backText2}>⌫</Text>
              </Pressable>
            </Animated.View>
          </>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
              <Bobo size={88} mood="happy" />
              <Text style={styles.title}>
                {isAz ? 'Razılığınız tələb olunur' : 'Нужно ваше согласие'}
              </Text>
              <Text style={styles.subtitle}>
                {isAz
                  ? 'Uşağınızın məlumatlarını işləməyə razılıq verin'
                  : 'Подтвердите согласие на обработку данных ребёнка'}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(500).delay(200)} style={styles.consentList}>
              <ConsentCheck
                checked={agreed.age}
                onPress={() => setAgreed((p) => ({ ...p, age: !p.age }))}
                label={
                  isAz
                    ? `Mən uşağın valideyni və ya qəyyumuyam${childAge ? ` (uşaq ${childAge} yaşında)` : ''}`
                    : `Я родитель или опекун ребёнка${childAge ? ` (${childAge} лет)` : ''}`
                }
              />
              <ConsentCheck
                checked={agreed.data}
                onPress={() => setAgreed((p) => ({ ...p, data: !p.data }))}
                label={
                  isAz
                    ? "Uşağın adı, cavabları və tərəqqi məlumatlarının saxlanılmasına razıyam"
                    : 'Согласен на хранение имени ребёнка, его ответов и прогресса'
                }
              />
              <ConsentCheck
                checked={agreed.audio}
                onPress={() => setAgreed((p) => ({ ...p, audio: !p.audio }))}
                label={
                  isAz
                    ? "Bobo ilə müzakirələr zamanı səs müvəqqəti AI partnyorlarına göndərilməsinə razıyam (audio yazılmır)"
                    : 'Согласен на отправку голоса AI-партнёрам (Deepgram, OpenAI) во время разговоров с Bobo. Аудио НЕ сохраняется'
                }
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(500).delay(400)}>
              <Pressable
                onPress={() => router.push('/legal/privacy' as any)}
                style={styles.privacyLink}
              >
                <Text style={styles.privacyLinkText}>
                  {isAz ? 'Məxfilik siyasətini oxu' : 'Прочитать политику конфиденциальности'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleProceed}
                disabled={!allAgreed}
                style={[styles.proceedBtn, !allAgreed && styles.proceedBtnDisabled]}
              >
                <LinearGradient
                  colors={allAgreed ? [colors.primary, colors.primaryDeep] : ['#CCCCCC', '#999999']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.proceedGradient}
                >
                  <Text style={styles.proceedText}>
                    {isAz ? 'Razıyam və davam et' : 'Согласен — продолжить'}
                  </Text>
                </LinearGradient>
              </Pressable>

              {/* Guest escape (was on the removed plan-summary page): day 1
                  locally, no account. Talking to Bobo still sends audio to AI
                  partners, so the AUDIO consent box must be ticked even here —
                  otherwise the mic stays gated. */}
              <Pressable
                onPress={() => {
                  if (!agreed.audio) {
                    setError(
                      isAz
                        ? 'Səs razılığını qeyd edin — Bobo ilə danışmaq üçün lazımdır.'
                        : 'Отметьте согласие на голос — оно нужно, чтобы говорить с Bobo.',
                    );
                    return;
                  }
                  setAudioConsent(true);
                  useSettings.getState().completeOnboarding();
                  router.replace('/home');
                }}
                style={{ paddingVertical: spacing[3], alignItems: 'center' }}
              >
                <Text style={[styles.privacyLinkText, !agreed.audio && { opacity: 0.5 }]}>
                  {isAz ? 'Hesabsız 1-ci günü sınamaq →' : 'Попробовать день 1 без аккаунта →'}
                </Text>
              </Pressable>
              {error ? (
                <Text style={[styles.errorText, { marginTop: spacing[1] }]}>{error}</Text>
              ) : null}
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

interface ConsentCheckProps {
  checked: boolean;
  onPress: () => void;
  label: string;
}

function ConsentCheck({ checked, onPress, label }: ConsentCheckProps) {
  return (
    <Pressable onPress={onPress} style={[styles.checkRow, shadow.sm]}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[16] ?? 64,
    paddingBottom: spacing[10],
  },
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

  gateCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing[5],
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[5],
  },
  dots: {
    flexDirection: 'row',
    gap: spacing[4],
    paddingVertical: spacing[2],
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  errorText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.error,
    textAlign: 'center',
  },

  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing[2],
  },
  numKey: {
    width: '30%',
    aspectRatio: 1.6,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numKeyGhost: { width: '30%', aspectRatio: 1.6 },
  numText: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
  },
  backKey: { backgroundColor: 'transparent' },
  backText2: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize['2xl'], color: colors.inkSoft },

  consentList: { gap: spacing[3], marginBottom: spacing[5] },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    backgroundColor: colors.white,
    padding: spacing[4],
    borderRadius: radius.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: { color: colors.white, fontFamily: fontFamily.bodyBlack, fontSize: fontSize.sm },
  checkLabel: {
    flex: 1,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.ink,
    lineHeight: 20,
  },

  privacyLink: { paddingVertical: spacing[3], alignItems: 'center' },
  privacyLinkText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.primary,
    textDecorationLine: 'underline',
  },

  proceedBtn: {
    borderRadius: radius.full,
    overflow: 'hidden',
    marginTop: spacing[3],
    ...shadow.glow,
  },
  proceedBtnDisabled: { opacity: 0.7 },
  proceedGradient: { paddingVertical: spacing[4], alignItems: 'center' },
  proceedText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.lg,
  },
});
