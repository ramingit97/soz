import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { KeyboardAvoider } from '@/components/KeyboardAvoider';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, radius, shadow, spacing } from '@/theme';

export default function SetupNameScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childLevel = useSettings((s) => s.childLevel);
  const childAge = useSettings((s) => s.childAge);
  const setChildProfile = useSettings((s) => s.setChildProfile);

  const [name, setName] = useState('');
  const inputRef = useRef<TextInput>(null);

  const isAz = lang === 'az';
  const canContinue = name.trim().length >= 2;

  const handleContinue = () => {
    if (!canContinue) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setChildProfile(name.trim(), childAge ?? 10, childLevel ?? 'beginner');
    router.push('/setup/interests' as any);
  };

  return (
    <Screen gradient decoration="bobo">
      <KeyboardAvoider
        footer={
          <Animated.View entering={FadeInUp.duration(400).delay(560)} style={styles.cta}>
            <HBButton
              full
              variant={canContinue ? 'primary' : 'soft'}
              label={isAz ? 'Davam et' : 'Продолжить'}
              onPress={handleContinue}
              disabled={!canContinue}
            />
          </Animated.View>
        }
      >
        {/* Progress */}
        <StepIndicator current={1} total={7} />

        <View style={styles.center}>
          <Animated.View entering={FadeInDown.duration(600).delay(100)}>
            <HBPet size={160} mood="curious" />
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(600).delay(280)} style={styles.textBlock}>
            <Text variant="title" align="center">
              {isAz ? 'Uşağınızın adı nədir?' : 'Как зовут вашего ребёнка?'}
            </Text>
            <Text variant="subtitle" tone="secondary" align="center" style={{ marginTop: spacing[3] }}>
              {isAz
                ? 'Dostu hər gün onun adı ilə müraciət edəcək'
                : 'Друг будет обращаться к нему по имени каждый день'}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(500).delay(420)} style={styles.inputWrap}>
            <Pressable onPress={() => inputRef.current?.focus()} style={[styles.inputBox, shadow.md]}>
              <TextInput
                ref={inputRef}
                value={name}
                onChangeText={setName}
                placeholder={isAz ? 'Məsələn: Əli' : 'Например: Алия'}
                placeholderTextColor={colors.inkSoft}
                style={styles.input}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                maxLength={30}
              />
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoider>
    </Screen>
  );
}

export function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={indicator.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            indicator.dot,
            {
              backgroundColor: i < current ? colors.primary : colors.borderStrong,
              width: i + 1 === current ? 28 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

const indicator = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  dot: { height: 8, borderRadius: 4 },
});

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[6],
  },
  textBlock: { paddingHorizontal: spacing[4] },
  inputWrap: { width: '100%' },
  inputBox: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderWidth: 2,
    borderColor: colors.border,
  },
  input: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 22,
    color: colors.ink,
    textAlign: 'center',
  },
  cta: { paddingBottom: spacing[6] },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center',
    ...shadow.glow,
  },
  btnDisabled: {
    backgroundColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  btnText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBlack,
    fontSize: 17,
    letterSpacing: 0.3,
  },
});
