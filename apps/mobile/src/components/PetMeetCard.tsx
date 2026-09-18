/**
 * «Давай познакомимся» — ребёнок даёт персонажу имя и выбирает цвет. Решение
 * владельца 2026-09-14: имя и цвет выбираются в `pet-room`, а не в онбординге
 * (экран `setup/pet` удалён). Пока имени нет, персонаж — мёд (55) и «Бобо».
 *
 * Имя уходит на сервер (`petName` в профиле — его знает промпт персонажа), цвет
 * хранится на телефоне.
 */
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { updateChild } from '@/services/api';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { PET_COLOR_NAMES, PET_HUES, petPaletteFor } from '@/theme/petPalette';
import { useCompanionName } from '@/utils/companion';

export function PetMeetCard() {
  const isAz = useSettings((s) => s.parentUILanguage) === 'az';
  const petHue = useSettings((s) => s.petHue);
  const setPetHue = useSettings((s) => s.setPetHue);
  const setPetName = useSettings((s) => s.setPetName);
  const childId = useSettings((s) => s.childId);
  const authToken = useSettings((s) => s.authToken);
  const bot = useCompanionName();
  const accent = useAccent();
  const [name, setName] = useState('');

  const save = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Пустое имя — оставить имя по умолчанию, но карточку закрыть.
    const chosen = name.trim() || bot;
    setPetName(chosen);
    if (childId && authToken) updateChild(childId, { petName: chosen }, authToken).catch(() => {});
  };

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <HBCard style={styles.card}>
        <Text variant="headline">{isAz ? 'Gəl tanış olaq!' : 'Давай познакомимся!'}</Text>
        <Text variant="caption" tone="secondary">
          {isAz ? 'Dostuna ad qoy və rəngini seç.' : 'Придумай другу имя и выбери цвет.'}
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={bot}
          placeholderTextColor={colors.textMuted}
          maxLength={20}
          style={[styles.input, { borderColor: name ? accent.bottom : colors.surfaceBorder }]}
          accessibilityLabel={isAz ? 'Dostun adı' : 'Имя друга'}
          returnKeyType="done"
        />

        <View style={styles.swatches}>
          {PET_HUES.map((h) => {
            const selected = petHue === h;
            return (
              <Pressable
                key={h}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setPetHue(h);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={isAz ? PET_COLOR_NAMES[h].az : PET_COLOR_NAMES[h].ru}
                style={[
                  styles.swatch,
                  { backgroundColor: petPaletteFor(h).body },
                  selected && { borderColor: colors.ink },
                ]}
              >
                {selected ? <Icon name="check" size={16} color={colors.white} strokeWidth={3} /> : null}
              </Pressable>
            );
          })}
        </View>

        <HBButton full icon="check" label={isAz ? 'Hazırdır' : 'Готово'} onPress={save} />
      </HBCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surface,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
