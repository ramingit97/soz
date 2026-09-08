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

import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { getChildren, loginUser } from '@/services/api';
import { fetchFullCurriculum } from '@/services/curriculum';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

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
              {isAz ? 'Xoş gəldiniz!' : 'С возвращением!'}
            </Text>
            <Text style={styles.subtitle}>
              {isAz ? 'Hesabınıza daxil olun' : 'Войдите в свой аккаунт'}
            </Text>
          </Animated.View>

          {/* Tab bar */}
          <Animated.View entering={FadeInUp.duration(500).delay(100)} style={styles.tabs}>
            <View style={styles.tabActive}>
              <Text style={styles.tabTextActive}>
                {isAz ? 'Daxil ol' : 'Войти'}
              </Text>
            </View>
            <Pressable
              style={styles.tabInactive}
              onPress={() => router.replace('/auth/register' as any)}
            >
              <Text style={styles.tabTextInactive}>
                {isAz ? 'Qeydiyyat' : 'Создать'}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInUp.duration(500).delay(180)} style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
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
              <View style={styles.labelRow}>
                <Text style={styles.label}>{isAz ? 'Şifrə' : 'Пароль'}</Text>
                <Pressable onPress={() => router.push('/auth/forgot' as any)}>
                  <Text style={styles.forgotLink}>
                    {isAz ? 'Unutdum?' : 'Забыл?'}
                  </Text>
                </Pressable>
              </View>
              <TextInput
                ref={pwRef}
                style={styles.input}
                placeholder={isAz ? 'Şifrənizi daxil edin' : 'Введите пароль'}
                placeholderTextColor={colors.inkSoft}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
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
                ? (isAz ? 'Yüklənir...' : 'Вход...')
                : (isAz ? 'Daxil ol →' : 'Войти →')}
              onPress={handleLogin}
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
            <Pressable onPress={() => router.replace('/auth/register' as any)}>
              <Text style={styles.footerText}>
                {isAz ? 'Hesabınız yoxdur? ' : 'Нет аккаунта? '}
                <Text style={styles.footerLink}>
                  {isAz ? 'Qeydiyyatdan keçin' : 'Зарегистрируйтесь'}
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
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
  forgotLink: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.primary,
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
    fontSize: 16,
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
    fontSize: 9,
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
