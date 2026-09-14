/**
 * Онбординг, шаг 4 — на что упор в плане: говорить, слушать или всё понемногу.
 *
 * Решение владельца 2026-09-14: разговор на тему и история на слух — не отдельные
 * плитки на главном, а шаги плана дня. Их доля зависит от этого ответа
 * (`lessonPrefs.moreTalk` / `moreListening`). «Всё понемногу» — пустой выбор.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { ChoiceCard } from '@/components/ChoiceCard';
import { HBButton } from '@/components/HBButton';
import { OnboardingStep } from '@/components/OnboardingStep';
import { useSettings, type LearningFocus } from '@/store/settings';
import { useCompanionName } from '@/utils/companion';

type Emphasis = 'speaking' | 'listening' | 'balanced';

const FOCUS: Record<Emphasis, LearningFocus[]> = {
  speaking: ['speaking'],
  listening: ['listening'],
  balanced: [],
};

export default function SetupFocusScreen() {
  const router = useRouter();
  const isAz = useSettings((s) => s.parentUILanguage) === 'az';
  const isAdult = useSettings((s) => s.profileType) === 'adult';
  const childName = useSettings((s) => s.childName) ?? '';
  const setLearningFocus = useSettings((s) => s.setLearningFocus);
  const bot = useCompanionName();

  const [emphasis, setEmphasis] = useState<Emphasis>('balanced');

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setLearningFocus(FOCUS[emphasis]);
    router.replace('/setup/building?create=1' as never);
  };

  const title = isAdult
    ? isAz ? 'Sizin üçün nə vacibdir?' : 'Что для вас важнее?'
    : isAz ? `${childName} nəyi daha çox sevir?` : `Что ${childName} любит больше?`;

  return (
    <OnboardingStep
      step={4}
      title={title}
      subtitle={isAz ? 'Hər günün planı buna görə qurulacaq' : 'Из этого будет складываться план на каждый день'}
      footer={<HBButton full icon="sparkles" label={isAz ? 'Planı qur' : 'Собрать план'} onPress={handleContinue} />}
    >
      <ChoiceCard
        icon="messages-square"
        title={isAz ? 'Danışmaq' : 'Говорить'}
        subtitle={isAz ? `${bot} ilə daha çox söhbət` : `Больше разговоров с ${bot}`}
        selected={emphasis === 'speaking'}
        onPress={() => setEmphasis('speaking')}
      />
      <ChoiceCard
        icon="headphones"
        title={isAz ? 'Dinləmək' : 'Слушать'}
        subtitle={isAz ? 'Daha çox səsli hekayə' : 'Больше историй на слух'}
        selected={emphasis === 'listening'}
        onPress={() => setEmphasis('listening')}
      />
      <ChoiceCard
        icon="sparkles"
        title={isAz ? 'Hər şeydən bir az' : 'Всё понемногу'}
        subtitle={isAz ? 'Sözlər, hekayələr və söhbət' : 'Слова, истории и разговоры'}
        selected={emphasis === 'balanced'}
        onPress={() => setEmphasis('balanced')}
      />
    </OnboardingStep>
  );
}
