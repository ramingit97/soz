/**
 * Онбординг, шаг 3 — какой язык учим.
 *
 * По умолчанию английский, один язык на курс (решение владельца 2026-09-20).
 * До этого по умолчанию стояли оба, и это была главная претензия: ребёнок учил
 * английский и русский одновременно и путался. Два языка остались третьим
 * выбором для тех, кто сознательно берёт двойную нагрузку.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { ChoiceCard } from '@/components/ChoiceCard';
import { HBButton } from '@/components/HBButton';
import { OnboardingStep } from '@/components/OnboardingStep';
import { getStrings } from '@/i18n/strings';
import { useSettings } from '@/store/settings';
import type { LanguageCode } from '@soz/shared-types';

type Choice = 'both' | 'en_only' | 'ru_only';

const LANGS: Record<Choice, LanguageCode[]> = {
  both: ['en', 'ru'],
  en_only: ['en'],
  ru_only: ['ru'],
};

export default function LearningLanguagesScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const setLearningLanguages = useSettings((s) => s.setLearningLanguages);
  const t = getStrings(lang);

  const [selected, setSelected] = useState<Choice>('en_only');

  const handleContinue = () => {
    setLearningLanguages(LANGS[selected]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.push('/setup/focus' as never);
  };

  return (
    <OnboardingStep
      step={3}
      title={t.learningLanguages.title}
      subtitle={t.learningLanguages.subtitle}
      footer={<HBButton full label={t.common.continue} onPress={handleContinue} />}
    >
      <ChoiceCard
        mark="EN"
        title={t.learningLanguages.onlyEnglish}
        subtitle={t.learningLanguages.onlyEnglishDesc}
        selected={selected === 'en_only'}
        onPress={() => setSelected('en_only')}
      />
      <ChoiceCard
        mark="RU"
        title={t.learningLanguages.onlyRussian}
        subtitle={t.learningLanguages.onlyRussianDesc}
        selected={selected === 'ru_only'}
        onPress={() => setSelected('ru_only')}
      />
      <ChoiceCard
        icon="globe"
        title={t.learningLanguages.both}
        subtitle={t.learningLanguages.bothDesc}
        selected={selected === 'both'}
        onPress={() => setSelected('both')}
      />
    </OnboardingStep>
  );
}
