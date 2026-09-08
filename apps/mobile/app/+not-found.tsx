import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Bobo } from '@/components/Bobo';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { colors, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';

export default function NotFound() {
  const bot = useCompanionName();
  return (
    <Screen gradient>
      <View style={styles.center}>
        <Bobo size={180} mood="curious" />
        <Text variant="title" align="center" style={{ marginTop: spacing[6] }}>
          Hmm, page not found
        </Text>
        <Text variant="subtitle" tone="secondary" align="center" style={{ marginTop: spacing[3] }}>
          {`${bot} can't find this place.`}
        </Text>
        <Link href="/" style={styles.link}>
          <Text variant="bodyBold" tone="bobo">
            Go back home →
          </Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  link: {
    marginTop: spacing[6],
    padding: spacing[4],
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
  },
});
