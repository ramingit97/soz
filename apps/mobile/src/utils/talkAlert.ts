/**
 * Реплика не дошла до Бобо — сказать об этом, а не молча вернуть кнопку
 * микрофона: ребёнок думает, что его не слышат, и говорит в пустоту.
 */
import { Alert } from 'react-native';

import { isRateLimitError } from '@/services/api';
import { useSettings } from '@/store/settings';

export function alertTalkFailure(e: unknown, bot: string): void {
  const az = useSettings.getState().parentUILanguage === 'az';
  if (isRateLimitError(e)) {
    // The daily allowance is used up. These screens are the child's — no
    // upsell here (store policy for kids apps, and simple decency); the
    // parent sees the counter and the Premium button on their own screen.
    Alert.alert(
      az ? `${bot} yorulub 😴` : `${bot} устал 😴`,
      az
        ? `${bot} bu gün çox danışdı və yatmağa gedir. Sabah davam edərik!`
        : `${bot} сегодня много разговаривал и идёт спать. Продолжим завтра!`,
    );
    return;
  }
  Alert.alert(
    az ? `${bot} cavab vermədi` : `${bot} не ответил`,
    az
      ? 'Bağlantı alınmadı. İnterneti yoxla və yenidən danış.'
      : 'Не получилось связаться. Проверь интернет и скажи ещё раз.',
  );
}
