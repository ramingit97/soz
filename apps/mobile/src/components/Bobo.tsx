/**
 * Bobo — устаревший алиас `HBPet` для экранов, которые ещё не переписаны
 * (уроки, авторизация, повтор). Новые экраны берут `HBPet` напрямую; вызовы
 * заменяются по ходу батчей, файл удаляется в B7.
 *
 * Своё покачивание убрано: `HBPet` дышит сам, и два наложенных движения
 * дёргали персонажа.
 */

import { View, type ViewStyle } from 'react-native';

import { HBPet, type HBPetMood } from './HBPet';
import { useAccent } from '@/hooks/useAccent';

interface BoboProps {
  size?: number;
  mood?: HBPetMood;
  style?: ViewStyle;
  hue?: number;
  /** Мягкий круг за персонажем (по умолчанию есть). */
  halo?: boolean;
}

export function Bobo({ size = 220, mood = 'happy', style, hue, halo = true }: BoboProps) {
  const accent = useAccent();
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      {halo ? (
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: accent.soft,
            opacity: 0.55,
          }}
        />
      ) : null}
      <HBPet size={Math.round(size * 0.8)} hue={hue} mood={mood} />
    </View>
  );
}
