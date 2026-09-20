/**
 * Worlds — visual grouping of the 30-day curriculum into 4 thematic arcs.
 * Pure presentation: changes nothing in the lesson data; just lets us show
 * the journey as "Home World → Nature World → School World → City World".
 */


export interface World {
  id: 'home' | 'nature' | 'school' | 'city';
  emoji: string;
  labelRu: string;
  labelAz: string;
  labelEn: string;
  /** Day range (inclusive) */
  startDay: number;
  endDay: number;
  /** Accent + soft tint colors */
  color: string;
  tint: string;
  /**
   * Место Азербайджана, к которому ведёт неделя: на карте «Пути» это остров-веха
   * в конце отрезка. Своя география — то, чего нет ни у одного конкурента.
   */
  landmarkRu: string;
  landmarkAz: string;
  /** Какую картинку рисовать на острове-вехе (`components/scene/Landmark`). */
  landmark: 'tower' | 'rocks' | 'roof' | 'flames';
}

export const WORLDS: World[] = [
  {
    id: 'home',
    emoji: '🏠',
    labelRu: 'Дом',
    labelAz: 'Ev',
    labelEn: 'Home',
    startDay: 1,
    endDay: 7,
    color: '#6C4DF2',
    tint: '#EDE7FF',
    landmarkRu: 'Девичья башня',
    landmarkAz: 'Qız qalası',
    landmark: 'tower',
  },
  {
    id: 'nature',
    emoji: '🌳',
    labelRu: 'Природа',
    labelAz: 'Təbiət',
    labelEn: 'Nature',
    startDay: 8,
    endDay: 14,
    color: '#38D6E8',
    tint: '#D9F7F3',
    landmarkRu: 'Гобустан',
    landmarkAz: 'Qobustan',
    landmark: 'rocks',
  },
  {
    id: 'school',
    emoji: '🎒',
    labelRu: 'Школа',
    labelAz: 'Məktəb',
    labelEn: 'School',
    startDay: 15,
    endDay: 21,
    color: '#6B54E0',
    tint: '#EAE6FF',
    landmarkRu: 'Шеки',
    landmarkAz: 'Şəki',
    landmark: 'roof',
  },
  {
    id: 'city',
    emoji: '🌆',
    labelRu: 'Город',
    labelAz: 'Şəhər',
    labelEn: 'City',
    startDay: 22,
    endDay: 30,
    color: '#B8930A',
    tint: '#FFF8D6',
    landmarkRu: 'Пламенные башни',
    landmarkAz: 'Alov qüllələri',
    landmark: 'flames',
  },
];

export function worldForDay(day: number): World {
  return WORLDS.find((w) => day >= w.startDay && day <= w.endDay) ?? WORLDS[0]!;
}

export function worldLabel(world: World, lang: string): string {
  if (lang === 'az') return world.labelAz;
  if (lang === 'en') return world.labelEn;
  return world.labelRu;
}
