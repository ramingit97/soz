/**
 * StepIndicator — где ты в онбординге. У малышей точки с вытянутой текущей, у
 * старших ровные сегменты: точки-бусины читаются как детские. Цвет — акцент.
 */
import { StyleSheet, View } from 'react-native';

import { useAccent } from '@/hooks/useAccent';
import { useUIMode } from '@/hooks/useUIMode';
import { spacing } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  /** С единицы. */
  current: number;
  total: number;
}

export function StepIndicator({ current, total }: Props) {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const accent = useAccent();
  const kid = useUIMode() === 'kid';
  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: current }}
    >
      {Array.from({ length: total }, (_, i) => {
        const reached = i < current;
        const isCurrent = i + 1 === current;
        return (
          <View
            key={i}
            style={[
              kid ? styles.dot : styles.segment,
              kid && isCurrent && styles.dotCurrent,
              { backgroundColor: reached ? accent.bottom : c.borderStrong },
            ]}
          />
        );
      })}
    </View>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotCurrent: { width: 24 },
  segment: { width: 28, height: 4, borderRadius: 2 },
}));
