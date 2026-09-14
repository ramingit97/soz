import type { ParentUILanguage } from '@soz/shared-types';

/**
 * Язык интерфейса при самом первом запуске — до того, как родитель что-то выбрал.
 *
 * Отдельного экрана выбора языка больше нет: welcome открывается сразу на языке
 * телефона, а переключатель AZ | RU стоит в его углу. Русский — только если
 * телефон на русском; всё остальное (азербайджанский, английский, турецкий)
 * получает азербайджанский, это основной язык рынка.
 */
export function detectParentLanguage(): ParentUILanguage {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    return locale.startsWith('ru') ? 'ru' : 'az';
  } catch {
    return 'az';
  }
}
