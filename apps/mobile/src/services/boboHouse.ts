/**
 * Bobo's house collection — each completed lesson day unlocks a new item.
 * Items are tied to lesson themes when possible.
 */

export interface HouseItem {
  id: string;
  emoji: string;
  unlockDay: number;
  nameRu: string;
  nameAz: string;
}

export const HOUSE_ITEMS: HouseItem[] = [
  { id: 'lamp', emoji: '🏮', unlockDay: 1, nameRu: 'Лампа', nameAz: 'Lampa' },
  { id: 'palette', emoji: '🎨', unlockDay: 2, nameRu: 'Палитра', nameAz: 'Palitra' },
  { id: 'photo', emoji: '🖼️', unlockDay: 3, nameRu: 'Семейное фото', nameAz: 'Ailə şəkli' },
  { id: 'pie', emoji: '🥧', unlockDay: 4, nameRu: 'Пирог', nameAz: 'Pirog' },
  { id: 'fishbowl', emoji: '🐠', unlockDay: 5, nameRu: 'Аквариум', nameAz: 'Akvarium' },
  { id: 'mirror', emoji: '🪞', unlockDay: 6, nameRu: 'Зеркало', nameAz: 'Güzgü' },
  { id: 'shirt', emoji: '👕', unlockDay: 7, nameRu: 'Рубашка', nameAz: 'Köynək' },
  { id: 'book', emoji: '📚', unlockDay: 8, nameRu: 'Книга', nameAz: 'Kitab' },
  { id: 'sofa', emoji: '🛋️', unlockDay: 9, nameRu: 'Диван', nameAz: 'Divan' },
  { id: 'shoes', emoji: '👟', unlockDay: 10, nameRu: 'Кеды', nameAz: 'Krossovka' },
  { id: 'umbrella', emoji: '☂️', unlockDay: 11, nameRu: 'Зонт', nameAz: 'Çətir' },
  { id: 'bus', emoji: '🚌', unlockDay: 12, nameRu: 'Автобус', nameAz: 'Avtobus' },
  { id: 'clock', emoji: '⏰', unlockDay: 13, nameRu: 'Будильник', nameAz: 'Saat' },
  { id: 'apple', emoji: '🍎', unlockDay: 14, nameRu: 'Яблоко', nameAz: 'Alma' },
  { id: 'tree', emoji: '🌳', unlockDay: 15, nameRu: 'Дерево', nameAz: 'Ağac' },
  { id: 'ball', emoji: '⚽', unlockDay: 16, nameRu: 'Мяч', nameAz: 'Top' },
  { id: 'guitar', emoji: '🎸', unlockDay: 17, nameRu: 'Гитара', nameAz: 'Gitara' },
  { id: 'heart', emoji: '💖', unlockDay: 18, nameRu: 'Сердце', nameAz: 'Ürək' },
  { id: 'medicine', emoji: '💊', unlockDay: 19, nameRu: 'Лекарство', nameAz: 'Dərman' },
  { id: 'briefcase', emoji: '💼', unlockDay: 20, nameRu: 'Портфель', nameAz: 'Çanta' },
  { id: 'building', emoji: '🏢', unlockDay: 21, nameRu: 'Здание', nameAz: 'Bina' },
  { id: 'snowman', emoji: '⛄', unlockDay: 22, nameRu: 'Снеговик', nameAz: 'Qardan adam' },
  { id: 'numbers', emoji: '🔢', unlockDay: 23, nameRu: 'Цифры', nameAz: 'Rəqəmlər' },
  { id: 'wave', emoji: '🌊', unlockDay: 24, nameRu: 'Волна', nameAz: 'Dalğa' },
  { id: 'phone', emoji: '📱', unlockDay: 25, nameRu: 'Телефон', nameAz: 'Telefon' },
  { id: 'paint', emoji: '🖌️', unlockDay: 26, nameRu: 'Кисть', nameAz: 'Fırça' },
  { id: 'calendar', emoji: '📅', unlockDay: 27, nameRu: 'Календарь', nameAz: 'Təqvim' },
  { id: 'scale', emoji: '⚖️', unlockDay: 28, nameRu: 'Весы', nameAz: 'Tərəzi' },
  { id: 'handshake', emoji: '🤝', unlockDay: 29, nameRu: 'Рукопожатие', nameAz: 'Görüş' },
  { id: 'crown', emoji: '👑', unlockDay: 30, nameRu: 'Корона!', nameAz: 'Tac!' },
];

export function getUnlockedItems(currentDay: number): HouseItem[] {
  return HOUSE_ITEMS.filter((item) => item.unlockDay < currentDay);
}

export function getNextItem(currentDay: number): HouseItem | null {
  return HOUSE_ITEMS.find((item) => item.unlockDay >= currentDay) ?? null;
}
