/**
 * Parental gate — a 4-digit PIN the parent sets once and re-enters before any
 * parent-only action (parent area, paywall, add-child, consent). Replaces the
 * old math challenge. Required by Apple kids guidelines (2.5.11) before IAP /
 * external links.
 *
 * First use → "create PIN" (enter + confirm). Later → "enter PIN". Forgot →
 * reset by confirming the account password (a child won't know it).
 *
 * Usage (unchanged):
 *   const gate = useParentalGate();
 *   <Button onPress={() => gate.run(() => router.push('/paywall'))} />
 *   <ParentalGateModal {...gate.modalProps} />
 */

import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { loginUser } from '@/services/api';
import { clearPin, hasPin, setPin, verifyPin } from '@/services/parentPin';
import { useSettings } from '@/store/settings';
import { fontFamily, fontSize, radius, shadow, spacing } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

export function useParentalGate() {
  const [visible, setVisible] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  const run = useCallback((action: () => void) => {
    pendingAction.current = action;
    setVisible(true);
  }, []);

  const handleSuccess = useCallback(() => {
    setVisible(false);
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) setTimeout(action, 200);
  }, []);

  const handleCancel = useCallback(() => {
    setVisible(false);
    pendingAction.current = null;
  }, []);

  return {
    run,
    modalProps: { visible, onSuccess: handleSuccess, onCancel: handleCancel },
  };
}

type Mode = 'loading' | 'create' | 'confirm' | 'enter' | 'forgot';

interface ParentalGateModalProps {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ParentalGateModal({ visible, onSuccess, onCancel }: ParentalGateModalProps) {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const userEmail = useSettings((s) => s.userEmail);
  const isAz = lang === 'az';

  const [mode, setMode] = useState<Mode>('loading');
  const [pin, setPinInput] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // On open: decide create vs enter based on whether a PIN exists.
  useEffect(() => {
    if (!visible) return;
    setPinInput('');
    setFirstPin('');
    setPw('');
    setError(null);
    setBusy(false);
    setMode('loading');
    hasPin().then((h) => setMode(h ? 'enter' : 'create')).catch(() => setMode('create'));
  }, [visible]);

  const reset = () => {
    setPinInput('');
    setError(null);
  };

  // Process a full 4-digit entry depending on the current mode.
  const processPin = useCallback(
    async (code: string) => {
      if (mode === 'create') {
        setFirstPin(code);
        setPinInput('');
        setError(null);
        setMode('confirm');
        return;
      }
      if (mode === 'confirm') {
        if (code === firstPin) {
          await setPin(code);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          onSuccess();
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          setError(isAz ? 'Kodlar uyğun gəlmədi' : 'Коды не совпали');
          setFirstPin('');
          setPinInput('');
          setMode('create');
        }
        return;
      }
      if (mode === 'enter') {
        setBusy(true);
        const ok = await verifyPin(code);
        setBusy(false);
        if (ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          onSuccess();
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          setError(isAz ? 'Yanlış kod' : 'Неверный код');
          setPinInput('');
        }
      }
    },
    [mode, firstPin, isAz, onSuccess],
  );

  // Auto-submit once 4 digits are entered.
  useEffect(() => {
    if (pin.length === 4 && (mode === 'create' || mode === 'confirm' || mode === 'enter')) {
      const t = setTimeout(() => processPin(pin), 120);
      return () => clearTimeout(t);
    }
  }, [pin, mode, processPin]);

  const handleDigit = (d: number) => {
    if (pin.length >= 4) return;
    Haptics.selectionAsync().catch(() => {});
    setError(null);
    setPinInput((p) => p + String(d));
  };
  const handleBackspace = () => {
    setError(null);
    setPinInput((p) => p.slice(0, -1));
  };

  const handleForgot = () => {
    if (userEmail) {
      setMode('forgot');
      setError(null);
    } else {
      // No account (trial) — nothing to verify against; allow a fresh PIN.
      clearPin().finally(() => {
        setMode('create');
        reset();
      });
    }
  };

  const handleForgotSubmit = async () => {
    if (!userEmail || pw.length < 1 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await loginUser(userEmail, pw);
      await clearPin();
      setPw('');
      setMode('create');
      setPinInput('');
    } catch {
      setError(isAz ? 'Yanlış şifrə' : 'Неверный пароль');
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<Mode, { title: string; sub: string }> = {
    loading: { title: '', sub: '' },
    create: {
      title: isAz ? 'Valideyn kodu yaradın' : 'Придумайте код для родителей',
      sub: isAz ? '4 rəqəm — yalnız sizin üçün' : '4 цифры — только для вас',
    },
    confirm: {
      title: isAz ? 'Kodu təkrarlayın' : 'Повторите код',
      sub: isAz ? 'Yadda saxlamaq üçün' : 'Чтобы запомнить',
    },
    enter: {
      title: isAz ? 'Valideyn kodunu daxil edin' : 'Введите родительский код',
      sub: isAz ? 'Bu hissə yalnız böyüklər üçündür' : 'Этот раздел только для взрослых',
    },
    forgot: {
      title: isAz ? 'Kodu sıfırla' : 'Сброс кода',
      sub: isAz ? 'Hesab şifrənizi daxil edin' : 'Введите пароль от аккаунта',
    },
  };
  const t = titles[mode];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable onPress={() => {}}>
          <Animated.View entering={FadeInDown.duration(280)} style={[styles.card, shadow.lg]}>
            {mode === 'loading' ? (
              <ActivityIndicator color={c.primary} style={{ paddingVertical: spacing[8] }} />
            ) : mode === 'forgot' ? (
              <>
                <Text style={styles.title}>{t.title}</Text>
                <Text style={styles.subtitle}>{t.sub}</Text>
                <TextInput
                  style={styles.pwInput}
                  value={pw}
                  onChangeText={(v) => {
                    setPw(v);
                    setError(null);
                  }}
                  placeholder={isAz ? 'Şifrə' : 'Пароль'}
                  placeholderTextColor={c.inkSoft}
                  secureTextEntry
                  autoFocus
                  autoCapitalize="none"
                />
                {error && <Text style={styles.errorText}>{error}</Text>}
                <View style={styles.buttonRow}>
                  <Pressable style={styles.cancelBtn} onPress={() => { setMode('enter'); reset(); }}>
                    <Text style={styles.cancelText}>{isAz ? 'Geri' : 'Назад'}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.submitBtn, (busy || !pw) && { opacity: 0.5 }]}
                    onPress={handleForgotSubmit}
                    disabled={busy || !pw}
                  >
                    <Text style={styles.submitText}>{isAz ? 'Təsdiqlə' : 'Подтвердить'}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.title}>{t.title}</Text>
                <Text style={styles.subtitle}>{t.sub}</Text>

                {/* PIN dots */}
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

                {/* Numpad */}
                <View style={styles.numpad}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <Pressable key={n} onPress={() => handleDigit(n)} style={[styles.numKey, shadow.sm]} disabled={busy}>
                      <Text style={styles.numText}>{n}</Text>
                    </Pressable>
                  ))}
                  <View style={styles.numKeyGhost} />
                  <Pressable onPress={() => handleDigit(0)} style={[styles.numKey, shadow.sm]} disabled={busy}>
                    <Text style={styles.numText}>0</Text>
                  </Pressable>
                  <Pressable onPress={handleBackspace} style={[styles.numKey, styles.backKey]} disabled={busy}>
                    <Text style={styles.backText}>⌫</Text>
                  </Pressable>
                </View>

                <View style={styles.footerRow}>
                  <Pressable onPress={onCancel} hitSlop={8}>
                    <Text style={styles.cancelText}>{isAz ? 'Ləğv et' : 'Отмена'}</Text>
                  </Pressable>
                  {mode === 'enter' && (
                    <Pressable onPress={handleForgot} hitSlop={8}>
                      <Text style={styles.forgotText}>{isAz ? 'Kodu unutmusan?' : 'Забыли код?'}</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  card: {
    backgroundColor: t.c.white,
    borderRadius: radius['2xl'],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[5],
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: t.c.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: t.c.inkSoft,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
    marginBottom: spacing[2],
  },

  dots: {
    flexDirection: 'row',
    gap: spacing[3],
    marginVertical: spacing[3],
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: t.c.border,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: t.c.primary,
    borderColor: t.c.primary,
  },

  errorText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: t.c.error,
    textAlign: 'center',
  },

  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  numKey: {
    width: '30%',
    aspectRatio: 1.7,
    backgroundColor: t.c.cream,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numKeyGhost: { width: '30%', aspectRatio: 1.7 },
  numText: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: t.c.ink,
  },
  backKey: { backgroundColor: 'transparent' },
  backText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize['2xl'], color: t.c.inkSoft },

  pwInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: t.c.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.lg,
    color: t.c.ink,
    marginVertical: spacing[2],
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: spacing[4],
    paddingHorizontal: spacing[2],
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing[2],
    width: '100%',
    marginTop: spacing[3],
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.full,
    alignItems: 'center',
    backgroundColor: t.c.cream,
  },
  cancelText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: t.c.inkSoft,
  },
  forgotText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: t.c.primary,
  },
  submitBtn: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.full,
    alignItems: 'center',
    backgroundColor: t.c.primary,
  },
  submitText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: t.c.white,
  },
}));
