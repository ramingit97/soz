/**
 * Возрастной режим решает, как выглядит всё приложение, а вход у него — три поля
 * стора, которые заполняются в разное время: диапазон на онбординге, возраст с
 * сервера, тип профиля. Поэтому проверяются все сочетания, включая устаревший
 * диапазон от предыдущего ребёнка.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Динамический импорт, как в progressQueue.test.mts: статический из .mts в
// CommonJS-модуль, собранный tsx, не видит именованных экспортов.
const { KID_MAX_AGE, uiModeFor } = await import('./mode.js');

const RANGES = ['5-7', '8-10', '11-13', '14-16', 'adult'] as const;

describe('uiModeFor', () => {
  it('взрослый профиль всегда teen, что бы ни лежало в возрасте', () => {
    for (const age of [null, 4, 6, 9, 12, 15, 25]) {
      for (const range of [null, ...RANGES]) {
        assert.equal(uiModeFor('adult', age, range), 'teen', `age=${age} range=${range}`);
      }
    }
  });

  it('возраст решает на границе: до KID_MAX_AGE включительно kid, дальше teen', () => {
    assert.equal(uiModeFor('kid', KID_MAX_AGE, null), 'kid');
    assert.equal(uiModeFor('kid', KID_MAX_AGE + 1, null), 'teen');
    assert.equal(uiModeFor('kid', 3, null), 'kid');
    assert.equal(uiModeFor('kid', 99, null), 'teen');
  });

  it('репрезентативные возрасты диапазонов дают ожидаемый режим', () => {
    // repAge из AGE_RANGE_META: 6, 9, 12, 15, 25
    assert.equal(uiModeFor('kid', 6, '5-7'), 'kid');
    assert.equal(uiModeFor('kid', 9, '8-10'), 'kid');
    assert.equal(uiModeFor('kid', 12, '11-13'), 'teen');
    assert.equal(uiModeFor('kid', 15, '14-16'), 'teen');
    assert.equal(uiModeFor('kid', 25, 'adult'), 'teen');
  });

  it('возраст важнее диапазона: syncChild не обновляет диапазон при смене ребёнка', () => {
    assert.equal(uiModeFor('kid', 6, '14-16'), 'kid');
    assert.equal(uiModeFor('kid', 15, '5-7'), 'teen');
  });

  it('без возраста решает диапазон', () => {
    assert.equal(uiModeFor('kid', null, '5-7'), 'kid');
    assert.equal(uiModeFor('kid', null, '8-10'), 'kid');
    assert.equal(uiModeFor('kid', null, '11-13'), 'teen');
    assert.equal(uiModeFor('kid', null, '14-16'), 'teen');
    assert.equal(uiModeFor('kid', undefined, 'adult'), 'teen');
  });

  it('пока о ребёнке ничего не известно — kid', () => {
    assert.equal(uiModeFor('kid', null, null), 'kid');
    assert.equal(uiModeFor(undefined, undefined, undefined), 'kid');
  });
});
