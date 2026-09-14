/**
 * Шапка главного: питомец (нажатие — его комната), приветствие, серия и звёзды.
 * Переключатель языка курса — только когда учат два языка.
 */
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { HBChip } from '../HBChip';
import { HBPet } from '../HBPet';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { useAccent } from '@/hooks/useAccent';
import { colors, radius, spacing } from '@/theme';

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
  languages: string[];
  activeLanguage: string;
  onLanguageChange: (lang: string) => void;
}

export function HomeHeader(p: Props) {
  const accent = useAccent();
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
          <HBPet size={34} hue={p.petHue} eyes={false} mood={p.petMood} />
        </Pressable>
        <Text variant="headline" numberOfLines={2} style={styles.greeting}>
          {p.isAz ? `Salam, ${p.childName}!` : `Привет, ${p.childName}!`}
        </Text>
        {p.streak > 0 ? (
          <HBChip
            label={String(p.streak)}
            leadingIcon={
              <Icon
                name={p.freezeUsed ? 'snowflake' : 'flame'}
                size={16}
                color={p.freezeUsed ? colors.english : colors.primaryDeep}
              />
            }
          />
        ) : null}
        <HBChip
          label={String(p.totalStars)}
          leadingIcon={<Icon name="star" size={16} color={colors.butterDeep} fill={colors.butter} />}
        />
      </View>

      {p.languages.length > 1 ? (
        <View style={styles.langRow} accessibilityRole="radiogroup">
          {p.languages.map((l) => {
            const active = l === p.activeLanguage;
            return (
              <Pressable
                key={l}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  p.onLanguageChange(l);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.langPill, active && { backgroundColor: accent.soft, borderColor: accent.bottom }]}
              >
                <Text variant="label" style={{ color: active ? accent.ink : colors.inkSoft }}>
                  {l === 'en' ? 'English' : 'Русский'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: { flex: 1, minWidth: 0 },
  langRow: { flexDirection: 'row', gap: spacing[2] },
  langPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
});
