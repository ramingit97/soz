/**
 * Онбординг, шаг 1 — «Для кого приложение?» + согласие родителя.
 *
 * Согласие — одна галочка на всё (решение владельца 2026-09-14): родитель,
 * хранение данных ребёнка, голос AI-партнёрам. Стоит здесь, а не перед
 * регистрацией в конце: гостевой аккаунт с именем и возрастом ребёнка создаётся в
 * конце онбординга, и согласие обязано быть раньше. Кнопка неактивна без галочки.
 *
 * Здесь же начинается новый профиль: `startNewProfileSetup` стирает данные
 * прошлого ребёнка — сюда же ведёт «Добавить ребёнка».
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChoiceCard } from '@/components/ChoiceCard';
import { HBButton } from '@/components/HBButton';
import { Icon } from '@/components/Icon';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { useSettings, type ProfileType } from '@/store/settings';
import { colors, radius, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';
import { consentLabel } from '@/utils/consent';

export default function ProfileTypeScreen() {
  const router = useRouter();
  const isAz = useSettings((s) => s.parentUILanguage) === 'az';
  const startNewProfileSetup = useSettings((s) => s.startNewProfileSetup);
  const setAudioConsent = useSettings((s) => s.setAudioConsent);
  const bot = useCompanionName();
  const accent = useAccent();

  const [who, setWho] = useState<ProfileType>('kid');
  const [agreed, setAgreed] = useState(false);

  const handleContinue = () => {
    if (!agreed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    startNewProfileSetup(who);
    setAudioConsent(true);
    router.push('/setup/name' as never);
  };

  const consentText = consentLabel(who, isAz);

  return (
    <OnboardingStep
      step={1}
      title={isAz ? 'Bu kim üçündür?' : 'Для кого приложение?'}
      subtitle={isAz ? `${bot} yaşa uyğunlaşacaq` : `${bot} подстроится под возраст`}
      footer={
        <HBButton
          full
          label={isAz ? 'Davam et' : 'Продолжить'}
          onPress={handleContinue}
          disabled={!agreed}
        />
      }
    >
      <ChoiceCard
        icon="baby"
        title={isAz ? 'Uşaq üçün' : 'Для ребёнка'}
        subtitle={isAz ? 'Valideyn qurur' : 'Настраивает родитель'}
        selected={who === 'kid'}
        onPress={() => setWho('kid')}
      />
      <ChoiceCard
        icon="user"
        title={isAz ? 'Özüm üçün' : 'Для себя'}
        subtitle={isAz ? 'Özüm öyrənirəm' : 'Учусь сам'}
        selected={who === 'adult'}
        onPress={() => setWho('adult')}
      />

      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setAgreed((v) => !v);
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        style={styles.consentRow}
      >
        <View
          style={[
            styles.checkbox,
            agreed && { backgroundColor: accent.bottom, borderColor: accent.bottom },
          ]}
        >
          {agreed ? <Icon name="check" size={16} color={accent.text} strokeWidth={3} /> : null}
        </View>
        <Text variant="caption" style={styles.consentText}>
          {consentText}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/legal/privacy' as never)}
        hitSlop={8}
        style={styles.policyLink}
      >
        <Text variant="caption" tone="brand">
          {isAz ? 'Məxfilik siyasəti' : 'Политика конфиденциальности'}
        </Text>
      </Pressable>
    </OnboardingStep>
  );
}

const CHECKBOX = 24;

const styles = StyleSheet.create({
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    marginTop: spacing[3],
  },
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
  consentText: { flex: 1 },
  policyLink: { alignSelf: 'flex-start', marginLeft: CHECKBOX + spacing[3] },
});
