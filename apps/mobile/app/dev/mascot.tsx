/**
 * Проверка маскота владельцем (план редизайна, раздел C): оба персонажа во всех
 * настроениях, размерах и цветах, с переключателями «говорит», «без движения»,
 * «голова / целиком».
 *
 * Не за `__DEV__`: в бандле EAS Update он `false`, а смотреть надо именно на
 * телефоне. Вход скрытый — пять нажатий по версии внизу «Профиля».
 */
import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { HBPet, type CompanionKind, useCompanionKind } from '@/components/HBPet';
import { PET_MOODS, type PetMood, type PetVariant } from '@/components/mascot/art';
import { PaperBackground } from '@/components/PaperBackground';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useSettings } from '@/store/settings';
import { radius, spacing } from '@/theme';
import { PET_HUES, petPaletteFor } from '@/theme/petPalette';
import { makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

const MOOD_LABEL: Record<PetMood, string> = {
  happy: 'радуется',
  neutral: 'спокоен',
  curious: 'интересно',
  listening: 'слушает',
  thinking: 'думает',
  sad: 'грустит',
  sleepy: 'спит',
};

const SIZES = [24, 32, 48, 96, 200];

export default function MascotScreen() {
  const { mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const profileKind = useCompanionKind();
  const storedHue = useSettings((s) => s.petHue);
  const [kind, setKind] = useState<CompanionKind>(profileKind);
  const [hue, setHue] = useState(storedHue);
  const [talking, setTalking] = useState(false);
  const [still, setStill] = useState(false);
  const [variant, setVariant] = useState<PetVariant | 'auto'>('auto');

  const pet = (size: number, mood: PetMood = 'happy', h = hue) => (
    <HBPet
      size={size}
      kind={kind}
      hue={h}
      mood={mood}
      talking={talking}
      still={still ? true : size < 48 ? undefined : false}
      variant={variant === 'auto' ? undefined : variant}
      onTap={() => Haptics.selectionAsync().catch(() => {})}
    />
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PaperBackground>
        <ScreenHeader title="Маскот" subtitle="Нажми на персонажа — он подпрыгнет" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.row}>
            <Toggle label="Медвежонок" on={kind === 'bear'} onPress={() => setKind('bear')} />
            <Toggle label="Робот" on={kind === 'robot'} onPress={() => setKind('robot')} />
          </View>
          <View style={styles.row}>
            <Toggle label="Говорит" on={talking} onPress={() => setTalking((v) => !v)} />
            <Toggle label="Без движения" on={still} onPress={() => setStill((v) => !v)} />
          </View>
          <View style={styles.row}>
            <Toggle label="Авто" on={variant === 'auto'} onPress={() => setVariant('auto')} />
            <Toggle label="Голова" on={variant === 'head'} onPress={() => setVariant('head')} />
            <Toggle label="Целиком" on={variant === 'full'} onPress={() => setVariant('full')} />
          </View>
          <View style={styles.row}>
            {PET_HUES.map((h) => (
              <Pressable
                key={h}
                onPress={() => setHue(h)}
                accessibilityLabel={`Цвет ${h}`}
                style={[
                  styles.swatch,
                  { backgroundColor: petPaletteFor(h).body },
                  hue === h && styles.swatchOn,
                ]}
              />
            ))}
          </View>

          <Text variant="headline" style={styles.section}>
            1. Силуэт
          </Text>
          <Text variant="caption" tone="secondary">
            Узнаётся ли персонаж на 24 и на 200? Мелкие размеры рисуются упрощённо.
          </Text>
          <View style={[styles.row, styles.bottom]}>
            {SIZES.map((s) => (
              <View key={s} style={styles.cell}>
                {pet(s)}
                <Text variant="caption" tone="secondary">
                  {s}
                </Text>
              </View>
            ))}
          </View>

          <Text variant="headline" style={styles.section}>
            2. Настроения
          </Text>
          <View style={styles.grid}>
            {PET_MOODS.map((m) => (
              <View key={m} style={styles.cell}>
                {pet(96, m)}
                <Text variant="caption" tone="secondary">
                  {MOOD_LABEL[m]}
                </Text>
              </View>
            ))}
          </View>

          <Text variant="headline" style={styles.section}>
            3. Цвета и движение
          </Text>
          <View style={styles.grid}>
            {PET_HUES.map((h) => (
              <View key={h} style={styles.cell}>
                {pet(72, 'happy', h)}
              </View>
            ))}
          </View>
        </ScrollView>
      </PaperBackground>
    </>
  );
}

function Toggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.toggle, on && styles.toggleOn]}
    >
      <Text variant="bodyBold" style={{ color: on ? c.white : c.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[10], gap: spacing[3] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], alignItems: 'center' },
  bottom: { alignItems: 'flex-end' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  cell: { alignItems: 'center', gap: spacing[1] },
  section: { marginTop: spacing[4] },
  toggle: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: t.c.surface,
    borderWidth: 1,
    borderColor: t.c.surfaceBorder,
  },
  toggleOn: { backgroundColor: t.c.ink, borderColor: t.c.ink },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: t.c.surface },
  swatchOn: { borderColor: t.c.ink },
}));
