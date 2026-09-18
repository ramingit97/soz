/**
 * Согласие родителя на обработку данных и голоса — одна галочка, как в
 * онбординге (`utils/consent.ts`, решение владельца 2026-09-14).
 *
 * Сюда ведёт «Говорить», если у профиля ещё нет согласия (профили до нового
 * онбординга). Раньше экран заставлял придумать PIN, отметить три галочки и
 * уводил на регистрацию. Теперь галочку подтверждает родитель своим PIN через
 * общий `ParentalGate` (он же создаст код, если его ещё нет), и экран
 * возвращает туда, откуда пришли. `?then=register` — после согласия на
 * регистрацию (старый путь из `setup/schedule` без аккаунта).
 */
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { Icon } from '@/components/Icon';
import { PaperBackground } from '@/components/PaperBackground';
import { ParentalGateModal, useParentalGate } from '@/components/ParentalGate';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { UIModeProvider } from '@/hooks/useUIMode';
import { useSettings } from '@/store/settings';
import { colors, radius, spacing } from '@/theme';
import { MODE_TOKENS } from '@/theme/modeTokens';
import { useCompanionName } from '@/utils/companion';
import { consentLabel } from '@/utils/consent';

export default function ConsentScreen() {
  const router = useRouter();
  const { then } = useLocalSearchParams<{ then?: string }>();
  const isAz = useSettings((s) => s.parentUILanguage) === 'az';
  const profileType = useSettings((s) => s.profileType);
  const setAudioConsent = useSettings((s) => s.setAudioConsent);
  const bot = useCompanionName();
  const accent = useAccent();
  const gate = useParentalGate();
  const [agreed, setAgreed] = useState(false);

  const finish = () => {
    setAudioConsent(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (then === 'register') router.replace('/auth/register' as never);
    else router.back();
  };

  return (
    <UIModeProvider force="teen">
      <PaperBackground>
        <ScreenHeader title={isAz ? 'Valideyn razılığı' : 'Согласие родителя'} />

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: MODE_TOKENS.teen.density.padX }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(450)}>
            <HBCard style={styles.intro}>
              <HBPet size={56} mood="listening" />
              <Text variant="body" style={styles.flex}>
                {isAz
                  ? `${bot} uşağı eşitsin deyə, valideynin razılığı lazımdır. Səs yalnız söhbət zamanı AI tərəfdaşlarına (OpenAI, Deepgram) göndərilir və yazılmır.`
                  : `Чтобы ${bot} слышал ребёнка, нужно согласие родителя. Голос уходит AI-партнёрам (OpenAI, Deepgram) только во время разговора и не записывается.`}
              </Text>
            </HBCard>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(450).delay(100)} style={styles.block}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setAgreed((v) => !v);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              style={styles.checkRow}
            >
              <View style={[styles.checkbox, agreed && { backgroundColor: accent.bottom, borderColor: accent.bottom }]}>
                {agreed ? <Icon name="check" size={16} color={accent.text} strokeWidth={3} /> : null}
              </View>
              <Text variant="caption" style={styles.flex}>
                {consentLabel(profileType, isAz)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/legal/privacy' as never)}
              hitSlop={8}
              accessibilityRole="link"
              style={styles.policyLink}
            >
              <Text variant="caption" style={{ color: accent.ink }}>
                {isAz ? 'Məxfilik siyasəti' : 'Политика конфиденциальности'}
              </Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(450).delay(180)} style={styles.block}>
            <HBButton
              full
              icon="shield-check"
              label={isAz ? 'Razıyam' : 'Согласен'}
              disabled={!agreed}
              onPress={() => gate.run(finish)}
            />
            <Text variant="caption" tone="secondary" align="center">
              {isAz ? 'Valideyn kodu ilə təsdiqləyin' : 'Подтвердите кодом родителя'}
            </Text>
          </Animated.View>
        </ScrollView>

        <ParentalGateModal {...gate.modalProps} />
      </PaperBackground>
    </UIModeProvider>
  );
}

const CHECKBOX = 24;

const styles = StyleSheet.create({
  scroll: { paddingTop: spacing[2], paddingBottom: spacing[10], gap: spacing[4] },
  intro: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1, minWidth: 0 },
  block: { gap: spacing[2] },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  checkbox: {
    width: CHECKBOX,
    height: CHECKBOX,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  policyLink: { alignSelf: 'flex-start', marginLeft: CHECKBOX + spacing[3] },
});
