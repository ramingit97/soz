/**
 * Режим дня у малышей и его подпись: ротация не ломается на краях, подпись на
 * языке интерфейса, а не изучаемом.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { kidModeForDay, lessonEntryRoute } = await import('./lessonFlow.js');
const { kidModeLabel } = await import('./lessonModes.js');

describe('kidModeForDay', () => {
  it('идёт по кругу квест → движение → ролевая игра → мир', () => {
    assert.deepEqual([1, 2, 3, 4, 5, 8].map(kidModeForDay), ['quest', 'tpr', 'pretend', 'world', 'quest', 'world']);
  });

  it('день 0 и отрицательный не дают неизвестный режим', () => {
    assert.equal(kidModeForDay(0), 'world');
    assert.equal(kidModeForDay(-1), 'pretend');
    assert.equal(lessonEntryRoute(0, 'en', false), '/lesson/world?lang=en&day=0');
  });
});

describe('kidModeLabel', () => {
  it('подпись на языке интерфейса, с именем персонажа', () => {
    assert.equal(kidModeLabel('quest', false, 'Бобо').name, 'Приключение');
    assert.equal(kidModeLabel('quest', true, 'Bobo').name, 'Macəra');
    assert.equal(kidModeLabel('tpr', false, 'Мишка').name, 'Двигайся с Мишка');
    assert.equal(kidModeLabel('world', true, 'Bobo').icon, 'globe');
  });
});
