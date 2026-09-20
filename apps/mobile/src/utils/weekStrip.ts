/**
 * Неделя серии для главного экрана взрослого режима (макет D): семь кружков
 * понедельник–воскресенье, где видно, какие дни уже закрыты.
 *
 * Считается из того, что и так лежит в сторе: длины серии и даты последнего
 * выполненного урока. Отдельный запрос на сервер за списком дат главный экран
 * не делает — это лишняя задержка ради полоски.
 *
 * Чистый модуль — проверяется `node --test`.
 */

export type DayState = 'done' | 'today' | 'missed' | 'future';

export interface WeekDay {
  /** Дата в ISO (YYYY-MM-DD). */
  date: string;
  /** Подпись под кружком. */
  label: string;
  state: DayState;
}

const LABELS_RU = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const LABELS_AZ = ['B.e', 'Ç.a', 'Çər', 'C.a', 'Cüm', 'Şnb', 'Baz'];

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Понедельник недели, в которую попадает дата. */
function mondayOf(date: Date): Date {
  const d = new Date(date);
  // getUTCDay: 0 — воскресенье, поэтому воскресенье сдвигаем на шесть назад.
  const shift = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - shift * DAY_MS);
}

export function weekStrip(
  streak: number,
  lastCompletedDate: string | null,
  todayISO: string,
  az = false,
): WeekDay[] {
  const today = new Date(`${todayISO}T00:00:00Z`);
  const monday = mondayOf(today);
  const labels = az ? LABELS_AZ : LABELS_RU;

  // Окно серии: streak дней подряд, заканчивающихся днём последнего урока.
  // Серия жива, только если последний урок был сегодня или вчера — иначе она
  // уже оборвалась, и закрашивать прошлые дни этой недели нечем.
  let from: number | null = null;
  let to: number | null = null;
  if (lastCompletedDate && streak > 0) {
    const last = new Date(`${lastCompletedDate}T00:00:00Z`).getTime();
    const gapDays = Math.round((today.getTime() - last) / DAY_MS);
    if (gapDays <= 1 && gapDays >= 0) {
      to = last;
      from = last - (streak - 1) * DAY_MS;
    }
  }

  return labels.map((label, i) => {
    const d = new Date(monday.getTime() + i * DAY_MS);
    const t = d.getTime();
    const date = iso(d);
    const inStreak = from !== null && to !== null && t >= from && t <= to;
    let state: DayState;
    if (t > today.getTime()) state = 'future';
    else if (date === todayISO) state = inStreak ? 'done' : 'today';
    else state = inStreak ? 'done' : 'missed';
    return { date, label, state };
  });
}
