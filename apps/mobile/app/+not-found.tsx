/**
 * Экрана по ссылке нет. Раньше текст был только по-английски.
 */
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { useTheme } from '@/hooks/useTheme';
import { useSettings } from '@/store/settings';
import { spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';

export default function NotFound() {
  const router = useRouter();
  const bot = useCompanionName();
  const isAz = useSettings((s) => s.parentUILanguage) === 'az';
  const { t } = useTheme();
  return (
    <PaperBackground edges={['top', 'bottom']}>
      <View style={[styles.center, { paddingHorizontal: t.density.padX }]}>
        <HBPet size={t.mascot.hero} mood="curious" />
        <Text variant="title" align="center">
          {isAz ? 'Belə səhifə yoxdur' : 'Такой страницы нет'}
        </Text>
        <Text variant="body" tone="secondary" align="center">
          {isAz ? `${bot} bu yeri tapa bilmədi.` : `${bot} не нашёл это место.`}
        </Text>
        <HBButton icon="house" label={isAz ? 'Ana səhifəyə' : 'На главную'} onPress={() => router.replace('/')} />
      </View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
});
