/**
 * Урок не должен засчитываться за молчание: ни сразу, ни после пустых попыток
 * записи, ни в разговоре «на время», пока персонаж не завершил беседу.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { MIN_LESSON_TALK_TURNS, canFinishTalkLesson, spokenTurns } = await import('./lessonTalk.js');

const child = (text: string) => ({ role: 'child', text });
const bobo = (text: string) => ({ role: 'bobo', text });

describe('spokenTurns', () => {
  it('считает только реплики ребёнка с распознанной речью', () => {
    assert.equal(spokenTurns([]), 0);
    assert.equal(spokenTurns([bobo('Hi! What is your name?')]), 0);
    assert.equal(spokenTurns([child('...'), bobo('Try again'), child('   '), child('')]), 0);
    assert.equal(spokenTurns([bobo('Hi'), child('My name is Ayla'), bobo('Nice!'), child('I like cats')]), 2);
  });
});

describe('canFinishTalkLesson', () => {
  it('без разговора урок не засчитывается', () => {
    assert.equal(canFinishTalkLesson({ spoken: 0, convoLesson: false, wrapUnlocked: false }), false);
    assert.equal(canFinishTalkLesson({ spoken: MIN_LESSON_TALK_TURNS - 1, convoLesson: false, wrapUnlocked: false }), false);
  });

  it('обычный разговорный шаг — после минимума реплик', () => {
    assert.equal(canFinishTalkLesson({ spoken: MIN_LESSON_TALK_TURNS, convoLesson: false, wrapUnlocked: false }), true);
  });

  it('разговор «на время» — ещё и после того, как персонаж завершил беседу', () => {
    assert.equal(canFinishTalkLesson({ spoken: 10, convoLesson: true, wrapUnlocked: false }), false);
    assert.equal(canFinishTalkLesson({ spoken: 1, convoLesson: true, wrapUnlocked: true }), false);
    assert.equal(canFinishTalkLesson({ spoken: MIN_LESSON_TALK_TURNS, convoLesson: true, wrapUnlocked: true }), true);
  });
});
