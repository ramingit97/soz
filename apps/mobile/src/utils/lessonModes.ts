/**
 * Названия и иконки игровых режимов урока малышей — в одном месте: их
 * показывают шапка шага и «Завтра» на экране завершения. Язык — интерфейса
 * (RU/AZ), а не изучаемый: семилетний азербайджанец, который учит английский,
 * не прочитает «Show Your World».
 */
import type { IconName } from '../components/Icon';
import type { KID_LESSON_MODES } from './lessonFlow';

export type KidLessonMode = (typeof KID_LESSON_MODES)[number];

export function kidModeLabel(mode: KidLessonMode, az: boolean, bot: string): { icon: IconName; name: string } {
  switch (mode) {
    case 'quest':
      return { icon: 'map', name: az ? 'Macəra' : 'Приключение' };
    case 'tpr':
      return { icon: 'zap', name: az ? `${bot} ilə hərəkət et` : `Двигайся с ${bot}` };
    case 'pretend':
      return { icon: 'drama', name: az ? 'Rol oyunu' : 'Ролевая игра' };
    case 'world':
      return { icon: 'globe', name: az ? 'Dünyanı göstər' : 'Покажи свой мир' };
  }
}
