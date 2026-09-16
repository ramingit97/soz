/**
 * Встроенные уроки для малышей рассказывают про медвежонка: в тексте историй и
 * наградах не остаётся робота, словарь и упражнения не меняются, ни одна замена
 * не устарела (фраза-источник есть в уроках).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { LESSONS, getLesson, setCompanionKindProvider } = await import('./lessons.js');
const { BEAR_EDITS, asBearLesson } = await import('./bearLessons.js');

const ROBOT = /robot|робот/i;

describe('asBearLesson', () => {
  for (const lang of ['en', 'ru'] as const) {
    it(`${lang}: в историях и наградах нет робота, картинки 🤖 заменены`, () => {
      for (const [day, lesson] of Object.entries(LESSONS[lang] ?? {})) {
        const bear = asBearLesson(lesson, lang);
        for (const scene of bear.story) {
          assert.ok(!ROBOT.test(scene.text), `${lang} день ${day}: «${scene.text}»`);
          assert.notEqual(scene.emoji, '🤖', `${lang} день ${day}: картинка робота`);
        }
        assert.ok(!ROBOT.test(bear.reward.message), `${lang} день ${day}: «${bear.reward.message}»`);
        assert.deepEqual(bear.vocabulary, lesson.vocabulary);
        assert.deepEqual(bear.wordGame, lesson.wordGame);
        assert.equal(bear.talkSystemPrompt, lesson.talkSystemPrompt);
      }
    });

    it(`${lang}: каждая замена находит свою фразу`, () => {
      const texts = Object.values(LESSONS[lang] ?? {}).flatMap((l) => [...l.story.map((s) => s.text), l.reward.message]);
      for (const [from] of BEAR_EDITS[lang]) {
        assert.ok(texts.some((t) => t.includes(from)), `${lang}: «${from}» нигде не встречается`);
      }
    });
  }

  it('getLesson пересказывает встроенный урок только для медвежонка', () => {
    setCompanionKindProvider(() => 'bear');
    assert.equal(getLesson('en', 1)?.story[0]?.text, "Hi! I'm Bobo. I'm a friendly bear cub.");
    setCompanionKindProvider(() => 'robot');
    assert.equal(getLesson('en', 1)?.story[0]?.text, "Hi! I'm Bobo. I'm a friendly robot.");
  });
});
