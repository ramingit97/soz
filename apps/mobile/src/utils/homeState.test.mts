/**
 * Главная карточка должна показывать ровно одно состояние, и блокирующие
 * состояния обязаны перекрывать урок: гость на 2-м дне не начнёт урок без
 * аккаунта, ребёнок без Premium не увидит «Начать урок» за пейволлом.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { deriveHomeState, resumeStep, todayPlanSteps } = await import('./homeState.js');

const base = {
  isTrialMode: false,
  currentDay: 3,
  needsUpgrade: false,
  isAiDay: false,
  curriculumReady: true,
  curriculumError: false,
  hasLesson: true,
  doneToday: false,
  isQuizDay: false,
};

describe('deriveHomeState', () => {
  it('обычный день — урок', () => {
    assert.equal(deriveHomeState(base), 'lesson');
  });

  it('гость: первый день — урок, со второго — регистрация', () => {
    assert.equal(deriveHomeState({ ...base, isTrialMode: true, currentDay: 1 }), 'lesson');
    assert.equal(deriveHomeState({ ...base, isTrialMode: true, currentDay: 2 }), 'register');
  });

  it('гость сразу после первого урока видит «урок выполнен», а не регистрацию', () => {
    // Завершение урока уже перевело currentDay на 2.
    assert.equal(deriveHomeState({ ...base, isTrialMode: true, currentDay: 2, doneToday: true }), 'done');
  });

  it('урок ещё собирается или не скачался', () => {
    assert.equal(deriveHomeState({ ...base, curriculumReady: false }), 'preparing');
    assert.equal(deriveHomeState({ ...base, curriculumReady: false, curriculumError: true }), 'error');
  });

  it('день после 30-го без плана — генерация', () => {
    assert.equal(deriveHomeState({ ...base, isAiDay: true, hasLesson: false }), 'generating');
  });

  it('Premium перекрывает урок, но не сегодняшний выполненный', () => {
    assert.equal(deriveHomeState({ ...base, needsUpgrade: true }), 'paywall');
    assert.equal(deriveHomeState({ ...base, needsUpgrade: true, curriculumReady: false }), 'paywall');
    assert.equal(deriveHomeState({ ...base, needsUpgrade: true, doneToday: true }), 'done');
  });

  it('выполненный сегодня урок важнее того, что следующий ещё собирается', () => {
    assert.equal(deriveHomeState({ ...base, doneToday: true, curriculumReady: false }), 'done');
    assert.equal(deriveHomeState({ ...base, doneToday: true, isAiDay: true, hasLesson: false }), 'done');
  });

  it('выполненный день важнее недельного теста', () => {
    assert.equal(deriveHomeState({ ...base, doneToday: true, isQuizDay: true }), 'done');
    assert.equal(deriveHomeState({ ...base, isQuizDay: true }), 'quiz');
  });
});

describe('todayPlanSteps', () => {
  it('упор дня решает, из чего урок', () => {
    assert.deepEqual(todayPlanSteps({ focus: 'story_listen', mature: false, isQuizDay: false }), ['listening']);
    assert.deepEqual(todayPlanSteps({ focus: 'conversation', mature: false, isQuizDay: false }), ['talk']);
  });

  it('обычный день: дети через игру со словами, старшие через чтение', () => {
    assert.deepEqual(todayPlanSteps({ focus: 'vocab_grammar', mature: false, isQuizDay: false }), ['words', 'grammar', 'talk']);
    assert.deepEqual(todayPlanSteps({ focus: undefined, mature: true, isQuizDay: false }), ['reading', 'grammar', 'talk']);
    assert.deepEqual(todayPlanSteps({ focus: 'review', mature: false, isQuizDay: false }), ['words', 'grammar', 'talk']);
  });

  it('день теста — только тест', () => {
    assert.deepEqual(todayPlanSteps({ focus: 'story_listen', mature: false, isQuizDay: true }), ['quiz']);
  });
});

describe('resumeStep', () => {
  const steps = ['words', 'grammar', 'talk'] as const;

  it('ничего не пройдено — с первого шага', () => {
    assert.equal(resumeStep([...steps], []), 'words');
  });

  it('пройдены «новые слова» — продолжаем с грамматики, а не с начала', () => {
    assert.equal(resumeStep([...steps], ['words']), 'grammar');
    assert.equal(resumeStep([...steps], ['words', 'grammar']), 'talk');
  });

  it('шаги, которых нет в сегодняшнем уроке, не мешают', () => {
    assert.equal(resumeStep([...steps], ['reading']), 'words');
  });

  it('всё пройдено — null', () => {
    assert.equal(resumeStep([...steps], ['talk', 'words', 'grammar']), null);
  });
});
