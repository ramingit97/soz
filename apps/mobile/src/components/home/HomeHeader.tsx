/**
 * Шапка главного: питомец (нажатие — его комната), приветствие, серия и звёзды.
 *
 * Переключателя языка курса здесь больше нет: с 2026-09-20 курс один (английский
 * по умолчанию). У старых профилей, где выбрали оба языка, курс переключается
 * строкой «Курс» в профиле — на главном эта пара кнопок только сбивала ребёнка.
 */
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { HBChip } from '../HBChip';
import { HBPet } from '../HBPet';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { spacing } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  isAz: boolean;
  childName: string;
  petHue: number;
  petMood: 'happy' | 'sleepy';
  streak: number;
  totalStars: number;
  /** Сегодня серию спасла заморозка — снежинка вместо огня. */
  freezeUsed: boolean;
  onPetPress: () => void;
}

export function HomeHeader(p: Props) {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  // В детском режиме шапка лежит на закатном небе сцены: пилюли «стеклянные»,
  // подписи белые. У взрослых фон ровный, и чипы остаются карточными.
  const onScene = uiMode === 'kid';
  const chipBg = onScene ? c.glass : undefined;
  const chipInk = onScene ? c.textOnDark : undefined;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            p.onPetPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={p.isAz ? 'Otaq' : 'Комната питомца'}
          style={styles.avatar}
          hitSlop={6}
        >
          <HBPet size={34} hue={p.petHue} mood={p.petMood} />
        </Pressable>
        <Text
          variant="headline"
          numberOfLines={2}
          style={[styles.greeting, onScene && { color: c.textOnDark }]}
        >
          {p.isAz ? `Salam, ${p.childName}!` : `Привет, ${p.childName}!`}
        </Text>
        {p.streak > 0 ? (
          <HBChip
            bg={chipBg}
            color={chipInk}
            label={String(p.streak)}
            leadingIcon={
              <Icon
                name={p.freezeUsed ? 'snowflake' : 'flame'}
                size={16}
                color={p.freezeUsed ? c.english : '#FF7A2F'}
              />
            }
          />
        ) : null}
        <HBChip
          bg={chipBg}
          color={chipInk}
          label={String(p.totalStars)}
          leadingIcon={<Icon name="star" size={16} color={c.goldDeep} fill={c.gold} />}
        />
      </View>
    </View>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  wrap: { gap: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: t.mode === 'kid' ? t.c.glass : t.c.surface,
    borderWidth: 1,
    borderColor: t.mode === 'kid' ? t.c.glassBorder : t.c.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: { flex: 1, minWidth: 0 },
}));
