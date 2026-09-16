/**
 * Реплика не дошла до Бобо — сказать об этом, а не молча вернуть кнопку
 * микрофона: ребёнок думает, что его не слышат, и говорит в пустоту.
 *
 * Экраны показывают это полоской: `talkFailureMessage` + `InlineBanner`
 * («Говорить», «Покажи мир», ролевая игра).
 */
import type { IconName } from '@/components/Icon';
import { isRateLimitError } from '@/services/api';
import { useSettings } from '@/store/settings';

export interface TalkFailureMessage {
  tone: 'warning' | 'danger';
  icon: IconName;
  title: string;
  text: string;
}

export function talkFailureMessage(e: unknown, bot: string): TalkFailureMessage {
  const az = useSettings.getState().parentUILanguage === 'az';
  if (isRateLimitError(e)) {
    // The daily allowance is used up. These screens are the child's — no
    // upsell here (store policy for kids apps, and simple decency); the
    // parent sees the counter and the Premium button on their own screen.
    return {
      tone: 'warning',
      icon: 'moon',
      title: az ? `${bot} yorulub` : `${bot} устал`,
      text: az
        ? `${bot} bu gün çox danışdı və yatmağa gedir. Sabah davam edərik!`
        : `${bot} сегодня много разговаривал и идёт спать. Продолжим завтра!`,
    };
  }
  return {
    tone: 'danger',
    icon: 'wifi-off',
    title: az ? `${bot} cavab vermədi` : `${bot} не ответил`,
    text: az
      ? 'Bağlantı alınmadı. İnterneti yoxla və yenidən danış.'
      : 'Не получилось связаться. Проверь интернет и скажи ещё раз.',
  };
}
