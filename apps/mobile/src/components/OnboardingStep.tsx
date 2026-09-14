/**
 * OnboardingStep — каркас одного шага онбординга: назад и индикатор сверху,
 * заголовок и подзаголовок слева, содержимое, кнопка внизу.
 *
 * Все шаги выглядят одинаково, чтобы родитель с первого экрана понимал, где
 * вопрос, где ответ и куда нажимать дальше. Экран прокручивается: на 320 × 712 dp
 * с открытой клавиатурой содержимое не влезает, и кнопка не должна теряться.
 */
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { HBBackButton } from './HBBackButton';
import { Screen } from './Screen';
import { StepIndicator } from './StepIndicator';
import { Text } from './Text';
import { spacing } from '@/theme';

/** Шаги онбординга после welcome: для кого → имя → языки → упор. */
export const ONBOARDING_STEPS = 4;

interface Props {
  step: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Кнопка (или кнопки) внизу экрана. */
  footer: ReactNode;
  /** Скрыть «назад» — например, на первом шаге после welcome его заменяет системный жест. */
  hideBack?: boolean;
}

export function OnboardingStep({ step, title, subtitle, children, footer, hideBack }: Props) {
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.topBar}>
        {hideBack ? <View style={styles.backPlaceholder} /> : <HBBackButton inline />}
        <StepIndicator current={step} total={ONBOARDING_STEPS} />
        <View style={styles.backPlaceholder} />
      </View>

      <Animated.View entering={FadeInUp.duration(400)} style={styles.heading}>
        <Text variant="title">{title}</Text>
        {subtitle ? (
          <Text variant="body" tone="secondary" style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(80)} style={styles.body}>
        {children}
      </Animated.View>

      <View style={styles.spacer} />
      <View style={styles.footer}>{footer}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing[2] },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  backPlaceholder: { width: 40 },
  heading: { marginTop: spacing[5] },
  subtitle: { marginTop: spacing[2] },
  body: { marginTop: spacing[6], gap: spacing[3] },
  spacer: { flexGrow: 1, minHeight: spacing[6] },
  footer: { gap: spacing[2], paddingBottom: spacing[2] },
});
