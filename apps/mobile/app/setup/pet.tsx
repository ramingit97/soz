/**
 * Honeybear · Create your friend (Step 3 of 6).
 *
 * The child gives the companion a NAME (free text) and a COLOR (hue swatch).
 * Distinct animal characters come later (they need real art); for now the same
 * plush Хани blob is recoloured. Persisted: petName + petHue in the settings
 * store — HBPet reads petHue by default everywhere after onboarding.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { HBBackButton } from '@/components/HBBackButton';
import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { KeyboardAvoider } from '@/components/KeyboardAvoider';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';
import { StepIndicator } from './name';

interface ColorOption {
  hue: number;
  nameRu: string;
  nameAz: string;
}

// Hues must match presets in HBPet.paletteFor (others snap to the nearest one).
const COLORS: ColorOption[] = [
  { hue: 55, nameRu: 'Медовый', nameAz: 'Bal' },
  { hue: 25, nameRu: 'Коралл', nameAz: 'Mərcan' },
  { hue: 350, nameRu: 'Розовый', nameAz: 'Çəhrayı' },
  { hue: 300, nameRu: 'Сливовый', nameAz: 'Gavalı' },
  { hue: 230, nameRu: 'Небесный', nameAz: 'Göy' },
  { hue: 175, nameRu: 'Мятный', nameAz: 'Nanə' },
  { hue: 90, nameRu: 'Лимонный', nameAz: 'Limon' },
];

export default function SetupPetScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const isAz = lang === 'az';
  const setPetHue = useSettings((s) => s.setPetHue);
  const setPetName = useSettings((s) => s.setPetName);
  const storedHue = useSettings((s) => s.petHue);
  const storedName = useSettings((s) => s.petName);

  const initialIdx = Math.max(0, COLORS.findIndex((c) => c.hue === storedHue));
  const [selectedIdx, setSelectedIdx] = useState<number>(initialIdx >= 0 ? initialIdx : 0);
  const [name, setName] = useState<string>(storedName ?? '');
  const selected = COLORS[selectedIdx]!;

  const petScale = useSharedValue(1);
  const petStyle = useAnimatedStyle(() => ({ transform: [{ scale: petScale.value }] }));

  // While the keyboard is up, the pet shrinks so the name input stays visible
  // above the keyboard (this screen had NO keyboard handling — the input hid
  // behind the keyboard on device).
  const keyboardUp = useKeyboardVisible();

  const handleSelect = (idx: number) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedIdx(idx);
    petScale.value = withSequence(
      withSpring(0.85, { damping: 14 }),
      withSpring(1, { damping: 10 }),
    );
  };

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPetHue(selected.hue);
    setPetName(name.trim() || null);
    router.push('/setup/age' as any);
  };

  const displayName = name.trim() || (isAz ? 'Hani' : 'Хани');

  return (
    <PaperBackground variant="honey">
      <View style={styles.container}>
        {/* top */}
        <View style={styles.topBar}>
          <HBBackButton inline />
          <View style={{ flex: 1 }} />
          <View style={{ width: 36 }} />
        </View>

        <StepIndicator current={3} total={7} />

        <KeyboardAvoider
          contentContainerStyle={styles.scroll}
          footer={
            <View style={styles.cta}>
              <HBButton
                full
                variant="primary"
                label={isAz ? 'İrəli →' : 'Дальше →'}
                onPress={handleContinue}
              />
            </View>
          }
        >
          {/* title */}
          <Animated.View entering={FadeInDown.duration(500)} style={styles.titleBlock}>
            <Text style={styles.title}>{isAz ? 'Dost yarat!' : 'Создай друга!'}</Text>
            <Text style={styles.subtitle}>
              {isAz ? 'Ad ver və rəng seç — bu, tətbiqin rəngi olacaq' : 'Дай имя и выбери цвет — он станет цветом приложения'}
            </Text>
          </Animated.View>

          {/* pet preview — compact while typing so the input stays visible */}
          <Animated.View
            entering={FadeInUp.duration(600).delay(120)}
            style={[styles.podiumWrap, keyboardUp && styles.podiumWrapCompact]}
          >
            <View style={styles.podiumHalo} />
            {!keyboardUp && <View style={styles.podiumShadow} />}
            <Animated.View style={petStyle}>
              <HBPet size={keyboardUp ? 72 : 132} hue={selected.hue} mood="happy" />
            </Animated.View>
          </Animated.View>

          <Animated.View key={`name-${displayName}`} entering={FadeIn.duration(300)} style={styles.nameTag}>
            <Text style={styles.nameTagText}>{displayName}</Text>
          </Animated.View>

          {/* name input */}
          <Animated.View entering={FadeInUp.duration(500).delay(200)}>
            <Text style={styles.label}>{isAz ? 'Adı' : 'Имя'}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={isAz ? 'Məs: Hani, Şəkər...' : 'Например: Хани, Лапка...'}
              placeholderTextColor={colors.inkSoft}
              maxLength={20}
              autoCapitalize="words"
              style={styles.input}
              returnKeyType="done"
            />
          </Animated.View>

          {/* color swatches */}
          <Animated.View entering={FadeInUp.duration(500).delay(280)}>
            <Text style={styles.label}>{isAz ? 'Rəng' : 'Цвет'}</Text>
            <View style={styles.swatches}>
              {COLORS.map((c, idx) => {
                const isSelected = idx === selectedIdx;
                return (
                  <Pressable
                    key={c.hue}
                    onPress={() => handleSelect(idx)}
                    style={({ pressed }) => [
                      styles.swatch,
                      isSelected && styles.swatchSelected,
                      isSelected ? shadow.sm : null,
                      pressed && { transform: [{ scale: 0.94 }] },
                    ]}
                  >
                    <HBPet size={40} hue={c.hue} eyes={false} still />
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </KeyboardAvoider>
      </View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: 50,
    paddingBottom: spacing[6],
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  stepText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    letterSpacing: 0.6,
  },

  scroll: { paddingBottom: spacing[4] },

  titleBlock: {
    alignItems: 'center',
    marginTop: spacing[3],
    gap: 4,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'],
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
  },

  podiumWrap: {
    width: 200,
    height: 180,
    alignSelf: 'center',
    marginTop: spacing[4],
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumWrapCompact: {
    height: 96,
    width: 120,
    marginTop: spacing[2],
  },
  podiumHalo: {
    position: 'absolute',
    inset: 0,
    borderRadius: 100,
    backgroundColor: 'rgba(245, 212, 102, 0.4)',
  },
  podiumShadow: {
    position: 'absolute',
    bottom: 14,
    left: 30,
    right: 30,
    height: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(60, 49, 33, 0.15)',
  },

  nameTag: {
    alignSelf: 'center',
    marginTop: -spacing[1],
    marginBottom: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    backgroundColor: colors.card,
    ...shadow.sm,
  },
  nameTagText: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: colors.ink,
    letterSpacing: -0.5,
  },

  label: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.caption,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.lg,
    color: colors.ink,
    borderWidth: 2,
    borderColor: colors.border,
  },

  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing[3],
  },
  swatch: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125, 90, 42, 0.10)',
  },
  swatchSelected: {
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.primary,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderTopColor: colors.primary,
    borderBottomColor: colors.primary,
  },

  cta: {
    paddingTop: spacing[3],
  },
});
