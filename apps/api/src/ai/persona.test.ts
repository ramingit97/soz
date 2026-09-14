/**
 * Персонаж в разговоре обязан совпадать с персонажем на экране: медвежонок у
 * ребёнка до 10 лет, робот у подростка и взрослого. Возрастная группа `mid`
 * накрывает обе стороны порога, поэтому решает возраст.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BEAR_MAX_AGE, companionKind, companionName } from './persona.js';

describe('companionKind', () => {
  it('взрослый — всегда робот', () => {
    assert.equal(companionKind(6, 'adult'), 'robot');
    assert.equal(companionKind(undefined, 'adult'), 'robot');
  });

  it('возраст решает на границе, даже внутри группы mid', () => {
    assert.equal(companionKind(BEAR_MAX_AGE, 'mid'), 'bear');
    assert.equal(companionKind(BEAR_MAX_AGE + 1, 'mid'), 'robot');
    assert.equal(companionKind(6, 'young'), 'bear');
    assert.equal(companionKind(15, 'teen'), 'robot');
  });

  it('без возраста решает группа', () => {
    assert.equal(companionKind(null, 'young'), 'bear');
    assert.equal(companionKind(null, 'mid'), 'bear');
    assert.equal(companionKind(null, 'teen'), 'robot');
    assert.equal(companionKind(undefined, undefined), 'bear');
  });
});

describe('companionName', () => {
  it('имя, которое дал ребёнок, главнее', () => {
    assert.equal(companionName('Baloo', 'en'), 'Baloo');
    assert.equal(companionName('  Лапка ', 'ru'), 'Лапка');
  });

  it('пусто или прежнее имя по умолчанию — Bobo / Бобо по языку', () => {
    assert.equal(companionName(null, 'en'), 'Bobo');
    assert.equal(companionName('', 'ru'), 'Бобо');
    assert.equal(companionName('Хани', 'ru'), 'Бобо');
    assert.equal(companionName('Hani', 'en'), 'Bobo');
  });
});
