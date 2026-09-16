/**
 * Встроенные уроки (дни 1–30, запасные на случай, когда плана с сервера нет)
 * написаны про Бобо-робота. С 2026-09-14 у детей до 10 лет персонаж —
 * медвежонок, и первый же урок показывал медвежонка над фразой «I'm a friendly
 * robot».
 *
 * Здесь — точные замены фраз для медвежонка: только в тексте историй, подписи
 * награды и картинке сцены. Словарь и упражнения не трогаются: «robot» остаётся
 * словом, которое учат, просто уже не про Бобо. Замены фразами, а не регуляркой
 * по слову: у русского «робот» пять падежей и «роботский», у медвежонка другой
 * род и склонение. Тест проверяет, что ни одного робота в тексте не осталось и
 * что ни одна замена не устарела.
 */
import type { LessonData } from './lessons';

type Edit = readonly [from: string, to: string];

export const BEAR_EDITS: Record<'en' | 'ru', readonly Edit[]> = {
  en: [
    ["I'm a friendly robot.", "I'm a friendly bear cub."],
    ["It's a robot house!", "It's a bear house!"],
    ['His robot suit is blue.', 'His scarf is blue.'],
    ['a big robot family!', 'a big bear family!'],
    ['This is robot mom.', 'This is mama bear.'],
    ['This is robot dad.', 'This is papa bear.'],
    ['Bobo checks all his robot parts today.', 'Bobo checks his paws and ears today.'],
    ['Two robot eyes, one robot nose, two robot ears.', 'Two bear eyes, one bear nose, two bear ears.'],
    ['Big robot hands and a big robot smile!', 'Big bear hands and a big bear smile!'],
    ['clapping his robot hands', 'clapping his bear paws'],
    ['five robot friends!', 'five bear friends!'],
    ['goes to robot school today!', 'goes to bear school today!'],
    ['at robot school', 'at bear school'],
    ['his robot house inside!', 'his bear house inside!'],
    ['to his robot house!', 'to his bear house!'],
    ['flying his robot plane', 'flying his toy plane'],
    ['His robot house is full', 'His bear house is full'],
    ['The robot doctor gives him medicine.', 'The bear doctor gives him medicine.'],
    ['some robot soup', 'some honey soup'],
    ['Nine robot friends, then TEN!', 'Nine bear friends, then TEN!'],
    ["he's a robot after all!", "he's a clever bear!"],
    ['upgraded his robot brain', 'trained his bear brain'],
    ['a personal robot calendar!', 'a personal honey calendar!'],
    ['a big robot friend and a small one.', 'a big bear friend and a small one.'],
  ],
  ru: [
    ['Я добрый робот.', 'Я добрый медвежонок.'],
    ['Это дом робота!', 'Это дом медвежонка!'],
    ['большая семья роботов!', 'большая семья медведей!'],
    ['Это мама-робот.', 'Это мама-медведица.'],
    ['Это папа-робот.', 'Это папа-медведь.'],
    ['Два глаза-робота, один нос, два уха.', 'Два глаза, один нос, два пушистых уха.'],
    ['своими роботскими руками', 'своими мягкими лапами'],
    ['пять друзей-роботов!', 'пять друзей-медвежат!'],
    ['в школу роботов', 'в лесную школу'],
    ['в школе роботов', 'в лесной школе'],
    ['на роботском самолёте', 'на игрушечном самолёте'],
    ['Доктор-робот даёт', 'Доктор-медведь даёт'],
    ['роботский суп', 'медовый суп'],
    ['Девять роботов, потом ДЕСЯТЬ!', 'Девять медвежат, потом ДЕСЯТЬ!'],
    ['он ведь робот!', 'он ведь умный медвежонок!'],
    ['личный роботский календарь!', 'личный медовый календарь!'],
    ['большой робот-друг и маленький.', 'большой друг-медведь и маленький.'],
  ],
};

const ROBOT_EMOJI = '🤖';
const BEAR_EMOJI = '🐻';

function applyEdits(text: string, edits: readonly Edit[]): string {
  let out = text;
  for (const [from, to] of edits) out = out.split(from).join(to);
  return out;
}

/** Встроенный урок, пересказанный про медвежонка. Урок из плана не трогать. */
export function asBearLesson(lesson: LessonData, lang: string): LessonData {
  const edits = BEAR_EDITS[lang as 'en' | 'ru'];
  if (!edits) return lesson;
  return {
    ...lesson,
    story: lesson.story.map((scene) => ({
      text: applyEdits(scene.text, edits),
      emoji: scene.emoji === ROBOT_EMOJI ? BEAR_EMOJI : scene.emoji,
    })),
    reward: { ...lesson.reward, message: applyEdits(lesson.reward.message, edits) },
  };
}
