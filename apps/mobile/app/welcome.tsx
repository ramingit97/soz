import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useCompactScreen } from '@/hooks/useCompactScreen';
import { detectParentLanguage } from '@/i18n/detectLanguage';
import { getStrings } from '@/i18n/strings';
import { useSettings } from '@/store/settings';
// eslint-disable-next-line @typescript-eslint/no-require-imports
declare const __DEV__: boolean;
import { colors, radius, shadow, spacing } from '@/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  // Отдельного экрана выбора языка нет: при первом запуске язык берётся с
  // телефона, переключатель AZ | RU — в углу. Выбор фиксируется первым нажатием.
  const storedLang = useSettings((s) => s.parentUILanguage);
  const setParentUILanguage = useSettings((s) => s.setParentUILanguage);
  const [detected] = useState(detectParentLanguage);
  const lang = storedLang ?? detected;
  const t = getStrings(lang);
  const go = (href: string) => {
    if (!storedLang) setParentUILanguage(lang);
    router.push(href as never);
  };
  const { short } = useCompactScreen();

  // scroll обязателен, а не для красоты. Содержимое этого экрана на 320 × 712 dp
  // занимает ~730 dp: маскот 170 + заголовок 36 px в четыре строки + подзаголовок
  // + две кнопки. Без прокрутки герой переполнял контейнер и РИСОВАЛСЯ ПОВЕРХ
  // кнопки «Начнём» — она накрывала строку абзаца. Это был самый первый экран
  // продукта. Прокрутка гарантирует, что до кнопки можно дойти на любом экране;
  // уменьшенный маскот на коротких экранах убирает необходимость прокручивать.
  return (
    <Screen gradient decoration="bobo" scroll>
      <View style={styles.langToggle} accessibilityRole="radiogroup">
        {(['az', 'ru'] as const).map((l) => (
          <Pressable
            key={l}
            onPress={() => setParentUILanguage(l)}
            accessibilityRole="radio"
            accessibilityState={{ selected: lang === l }}
            hitSlop={6}
            style={[styles.langOption, lang === l && styles.langOptionOn]}
          >
            <Text variant="label" tone={lang === l ? 'primary' : 'secondary'}>
              {l.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.heroSection}>
        <Animated.View entering={FadeInDown.duration(700).delay(100)}>
          <HBPet size={short ? 120 : 170} mood="happy" />
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(600).delay(280)}>
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text variant="label" tone="bobo">
              Söz · AI {lang === 'az' ? 'müəllim' : 'репетитор'}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(700).delay(420)} style={styles.headlineWrap}>
          <Text variant="title" align="center">
            {t.welcome.title}
          </Text>
          <Text
            variant="subtitle"
            tone="secondary"
            align="center"
            style={{ marginTop: spacing[3] }}
          >
            {t.welcome.subtitle}
          </Text>
        </Animated.View>

      </View>

      <Animated.View entering={FadeInUp.duration(600).delay(560)} style={styles.ctaSection}>
        <HBButton full label={t.welcome.cta} onPress={() => go('/setup/profile-type')} />
        <HBButton
          full
          label={t.welcome.haveAccount}
          variant="ghost"
          size="md"
          onPress={() => go('/auth/login')}
        />

        {/* Dev-only reset button */}
        {__DEV__ && (
          <Pressable
            onPress={() => {
              useSettings.getState().reset();
              router.replace('/welcome');
            }}
            style={styles.devReset}
          >
            <Text style={{ fontSize: 11, color: colors.inkSoft }}>⚙ reset onboarding</Text>
          </Pressable>
        )}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  langToggle: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    marginTop: spacing[2],
    padding: 3,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  langOption: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  langOptionOn: { backgroundColor: colors.bgDeep },
  heroSection: {
    // Не flex:1 — внутри ScrollView это распирало бы блок и возвращало ту же
    // поломку. flexGrow отдаёт герою лишнее место, когда оно есть, и не мешает
    // прокрутке, когда его нет.
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing[6],
    gap: spacing[3],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.white,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    marginTop: spacing[4],
    ...shadow.sm,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  headlineWrap: {
    paddingHorizontal: spacing[2],
  },
  ctaSection: {
    paddingBottom: spacing[6],
    gap: spacing[3],
  },
  ribbonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.white,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 2,
  },
  plus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devReset: {
    marginTop: spacing[2],
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
});
