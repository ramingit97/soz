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
import { useCompactScreen } from '@/hooks/useCompactScreen';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

export default function SetupNameScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childLevel = useSettings((s) => s.childLevel);
  const childAge = useSettings((s) => s.childAge);
  const setChildProfile = useSettings((s) => s.setChildProfile);

  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const keyboardUp = useKeyboardVisible();
  const { short } = useCompactScreen();

  // Маскот ужимается, когда открыта клавиатура или экран короткий. Без этого на
  // 320 × 712 dp поле ввода уезжало за нижний край: с клавиатурой остаётся ~400
  // dp, а содержимое (маскот 160 + заголовок 36 px в три строки + подзаголовок +
  // поле) занимает ~540. KeyboardAvoider здесь не спасал — он НИЧЕГО не делает
  // на Android (второй строкой `if (Platform.OS !== 'ios') return`) и полагается
  // на системный adjustResize: окно сжимается, прокрутка появляется, но к полю
  // никто не подкручивает, и человек видит пустоту. Пока печатаешь, большой
  // маскот и не нужен.
  const petSize = keyboardUp ? 72 : short ? 120 : 160;

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
            <HBPet size={petSize} mood="curious" />
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

          {/* Подпись + выравнивание по левому краю + обычное начертание — это
              исправление, а не украшение. Поле было набрано ExtraBold'ом 22 px
              по ЦЕНТРУ в белой таблетке с тенью, то есть выглядело ровно как
              кнопка. Под ним стояла настоящая кнопка «Продолжить» той же
              ширины и формы. Владелец на device QA не понял, куда нажимать, —
              на своём же продукте. */}
          <Animated.View entering={FadeInUp.duration(500).delay(420)} style={styles.inputWrap}>
            <Text variant="label" tone="secondary" style={styles.inputLabel}>
              {isAz ? 'Ad' : 'Имя'}
            </Text>
            <Pressable
              onPress={() => inputRef.current?.focus()}
              style={[styles.inputBox, focused && styles.inputBoxFocused, shadow.sm]}
            >
              <TextInput
                ref={inputRef}
                value={name}
                onChangeText={setName}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={isAz ? 'Məsələn: Əli' : 'Например: Алия'}
                placeholderTextColor={colors.textMuted}
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
  inputWrap: { width: '100%', gap: spacing[2] },
  inputLabel: { marginLeft: spacing[2] },
  inputBox: {
    backgroundColor: colors.white,
    // md → lg: форма поля должна отличаться от формы кнопки, а не повторять её.
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderWidth: 2,
    borderColor: colors.border,
  },
  inputBoxFocused: { borderColor: colors.primary },
  input: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'left',
    // Android иначе режет высокие буквы и подчёркивает поле своим стилем.
    padding: 0,
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
