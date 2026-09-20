/**
 * Онбординг, шаг 2 — имя и возраст одним экраном (для себя — только имя).
 *
 * Возраст — диапазоном из четырёх карточек, а не точным числом: он задаёт
 * регистр уроков (`ageBand`) и возрастной режим интерфейса, точнее не нужно.
 * Уровень не спрашиваем: все начинают с beginner, план подстраивается сам.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ChoiceCard } from '@/components/ChoiceCard';
import { HBButton } from '@/components/HBButton';
import { OnboardingStep } from '@/components/OnboardingStep';
import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { AGE_RANGE_META, useSettings, type AgeRange } from '@/store/settings';
import { fontFamily, fontSize, radius, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';
import { makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

const KID_RANGES: { key: AgeRange; ru: string; az: string }[] = [
  { key: '5-7', ru: 'до школы, 1 класс', az: 'məktəbə qədər, 1-ci sinif' },
  { key: '8-10', ru: 'начальные классы', az: 'ibtidai siniflər' },
  { key: '11-13', ru: 'средние классы', az: 'orta siniflər' },
  { key: '14-16', ru: 'старшие классы', az: 'yuxarı siniflər' },
];

export default function SetupNameScreen() {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const router = useRouter();
  const isAz = useSettings((s) => s.parentUILanguage) === 'az';
  const isAdult = useSettings((s) => s.profileType) === 'adult';
  const setChildProfile = useSettings((s) => s.setChildProfile);
  const setChildAgeRange = useSettings((s) => s.setChildAgeRange);
  const bot = useCompanionName();
  const accent = useAccent();

  const [name, setName] = useState('');
  const [range, setRange] = useState<AgeRange | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const canContinue = name.trim().length >= 2 && (isAdult || range !== null);

  const handleContinue = () => {
    if (!canContinue) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const chosen: AgeRange = isAdult ? 'adult' : range!;
    setChildAgeRange(chosen);
    setChildProfile(name.trim(), AGE_RANGE_META[chosen].repAge, 'beginner');
    router.push('/learning-languages' as never);
  };

  const title = isAdult
    ? isAz ? 'Adınız nədir?' : 'Как вас зовут?'
    : isAz ? 'Uşaq haqqında' : 'Расскажите о ребёнке';
  const subtitle = isAdult
    ? isAz ? `${bot} sizə adınızla müraciət edəcək` : `${bot} будет обращаться к вам по имени`
    : isAz ? `${bot} onu adı ilə çağıracaq və dərsləri yaşa uyğun seçəcək` : `${bot} будет звать ребёнка по имени и подберёт уроки под возраст`;

  return (
    <OnboardingStep
      step={2}
      title={title}
      subtitle={subtitle}
      footer={
        <HBButton
          full
          label={isAz ? 'Davam et' : 'Продолжить'}
          onPress={handleContinue}
          disabled={!canContinue}
        />
      }
    >
      <Text variant="label" tone="secondary">
        {isAz ? 'Ad' : 'Имя'}
      </Text>
      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={[styles.inputBox, focused && { borderColor: accent.bottom }]}
      >
        <TextInput
          ref={inputRef}
          value={name}
          onChangeText={setName}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={isAz ? 'Məsələn: Əli' : 'Например: Алия'}
          placeholderTextColor={c.textMuted}
          style={styles.input}
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
          maxLength={30}
        />
      </Pressable>

      {!isAdult ? (
        <>
          <Text variant="label" tone="secondary" style={styles.ageLabel}>
            {isAz ? 'Yaş' : 'Возраст'}
          </Text>
          <View style={styles.grid}>
            {KID_RANGES.map((r) => (
              <ChoiceCard
                key={r.key}
                compact
                title={isAz ? `${r.key.replace('-', '–')} yaş` : `${r.key.replace('-', '–')} лет`}
                subtitle={isAz ? r.az : r.ru}
                selected={range === r.key}
                onPress={() => {
                  Keyboard.dismiss();
                  setRange(r.key);
                }}
                style={styles.gridItem}
              />
            ))}
          </View>
        </>
      ) : null}
    </OnboardingStep>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  inputBox: {
    backgroundColor: t.c.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderWidth: 2,
    borderColor: t.c.surfaceBorder,
  },
  input: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xl,
    color: t.c.ink,
    textAlign: 'left',
    // Android иначе режет высокие буквы и подчёркивает поле своим стилем.
    padding: 0,
  },
  ageLabel: { marginTop: spacing[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  gridItem: { width: '48.5%', flexGrow: 1 },
}));
