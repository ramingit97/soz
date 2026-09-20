/**
 * Переключатель «Войти | Создать» над формой входа и регистрации.
 */
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { radius, spacing } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

export function AuthTabs({ active, az }: { active: 'login' | 'register'; az: boolean }) {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const router = useRouter();
  const accent = useAccent();
  const tabs = [
    { key: 'login' as const, label: az ? 'Daxil ol' : 'Войти', route: '/auth/login' },
    { key: 'register' as const, label: az ? 'Qeydiyyat' : 'Создать', route: '/auth/register' },
  ];
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            disabled={on}
            onPress={() => router.replace(t.route as never)}
            style={[styles.tab, on && { backgroundColor: c.surface, borderColor: c.surfaceBorder }]}
          >
            <Text variant="bodyBold" style={{ color: on ? accent.ink : c.inkSoft }}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: t.c.bgDeep,
    borderRadius: radius.full,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
}));
