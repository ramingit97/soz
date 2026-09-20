/**
 * Акцент приложения — цвет режима, а не цвет питомца.
 *
 * До 2026-09-20 акцент брался из выбранного ребёнком оттенка питомца: приложение
 * целиком перекрашивалось под «твой цвет». В макетах C и D у каждого режима свой
 * фиксированный акцент (фиолетовый у детей, мятный у взрослых), иначе сцена,
 * кнопки и вкладки расходятся с фоном. Выбранный цвет по-прежнему красит самого
 * персонажа — это `petPaletteFor` в `HBPet`, он не затронут.
 *
 * Форма объекта сохранена: 219 обращений `accent.ink` / `accent.bottom` /
 * `accent.soft` / `accent.text` в экранах продолжают работать без правок.
 */
import { PALETTES } from './palettes';
import type { UIMode } from './mode';

export interface Accent {
  /** Верх градиента — чуть светлее. */
  top: string;
  /** Низ градиента, он же сплошной акцент. */
  bottom: string;
  /** Читаемая подпись на акценте. */
  text: string;
  /** Мягкая заливка: чипы, halo, дорожки прогресса. */
  soft: string;
  /** Акцент как цвет иконки или короткой подписи на карточке и на `soft`. */
  ink: string;
}

const ACCENTS: Record<UIMode, Accent> = {
  kid: {
    top: '#8E73FF',
    bottom: PALETTES.kid.primary,
    text: '#FFFFFF',
    soft: PALETTES.kid.primarySoft,
    ink: PALETTES.kid.accentInk,
  },
  teen: {
    top: '#5BEDE0',
    bottom: PALETTES.teen.primary,
    // На мятном нужен тёмный текст: белый на #3DE0D0 даёт контраст 1.8.
    text: PALETTES.teen.bg,
    soft: PALETTES.teen.primarySoft,
    ink: PALETTES.teen.accentInk,
  },
};

/** Чистая функция: акцент возрастного режима. */
export function accentFor(mode: UIMode): Accent {
  return ACCENTS[mode];
}
