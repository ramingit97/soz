import { useSettings } from '@/store/settings';

export interface Achievement {
  id: string;
  emoji: string;
  titleRu: string;
  titleAz: string;
  descRu: string;
  descAz: string;
  isUnlocked: () => boolean;
}

interface SimpleStats {
  totalStars: number;
  streak: number;
  currentDay: number;
  isPremium: boolean;
}

function stats(): SimpleStats {
  const s = useSettings.getState();
  return {
    totalStars: s.totalStars,
    streak: s.streak,
    currentDay: s.currentDay,
    isPremium: s.isPremium,
  };
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_lesson',
    emoji: '🌱',
    titleRu: 'Первый шаг',
    titleAz: 'İlk addım',
    descRu: 'Завершил первый урок',
    descAz: 'İlk dərsi tamamladı',
    isUnlocked: () => stats().currentDay > 1,
  },
  {
    id: 'three_days',
    emoji: '🌿',
    titleRu: 'Три дня подряд',
    titleAz: 'Üç gün ardıcıl',
    descRu: 'Стрик 3 дня',
    descAz: '3 günlük seriya',
    isUnlocked: () => stats().streak >= 3,
  },
  {
    id: 'week_streak',
    emoji: '🔥',
    titleRu: 'Неделя в огне',
    titleAz: 'Bir həftə',
    descRu: 'Стрик 7 дней',
    descAz: '7 günlük seriya',
    isUnlocked: () => stats().streak >= 7,
  },
  {
    id: 'hundred_stars',
    emoji: '⭐',
    titleRu: 'Сто звёзд',
    titleAz: 'Yüz ulduz',
    descRu: '100 звёзд собрано',
    descAz: '100 ulduz toplandı',
    isUnlocked: () => stats().totalStars >= 100,
  },
  {
    id: 'half_journey',
    emoji: '🚀',
    titleRu: 'Полпути',
    titleAz: 'Yarı yol',
    descRu: 'Прошёл 15 дней',
    descAz: '15 gün keçdi',
    isUnlocked: () => stats().currentDay > 15,
  },
  {
    id: 'static_complete',
    emoji: '🏆',
    titleRu: 'Месяц с Bobo',
    titleAz: 'Bobo ilə bir ay',
    descRu: 'Завершил все 30 дней',
    descAz: 'Bütün 30 günü bitirdi',
    isUnlocked: () => stats().currentDay > 30,
  },
  {
    id: 'premium',
    emoji: '👑',
    titleRu: 'Premium член семьи',
    titleAz: 'Premium üzvü',
    descRu: 'Открыл Söz Premium',
    descAz: 'Söz Premium açdı',
    isUnlocked: () => stats().isPremium,
  },
  {
    id: 'monthly_streak',
    emoji: '💎',
    titleRu: 'Алмазный стрик',
    titleAz: 'Almaz seriya',
    descRu: 'Стрик 30 дней',
    descAz: '30 günlük seriya',
    isUnlocked: () => stats().streak >= 30,
  },
];

export function unlockedCount(): number {
  return ACHIEVEMENTS.filter((a) => a.isUnlocked()).length;
}
