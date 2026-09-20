import assert from 'node:assert/strict';
import { test } from 'node:test';

const { PALETTES } = await import('./palettes.js');

test('оба режима описывают один и тот же набор ключей', () => {
  // Экраны читают цвет как `t.c.<ключ>` и не знают о режиме. Пропущенный ключ в
  // одном из режимов — это `undefined` в стиле и невидимый текст на устройстве.
  assert.deepEqual(Object.keys(PALETTES.kid).sort(), Object.keys(PALETTES.teen).sort());
  for (const group of ['tints', 'semantic'] as const) {
    assert.deepEqual(
      Object.keys(PALETTES.kid[group]).sort(),
      Object.keys(PALETTES.teen[group]).sort(),
      `${group}: наборы ключей разошлись`,
    );
  }
});

const isColor = (v: string) => /^#[0-9A-Fa-f]{3,8}$/.test(v) || /^rgba?\(/.test(v);

test('каждое значение — цвет или набор цветов', () => {
  const check = (path: string, value: unknown) => {
    if (typeof value === 'string') {
      assert.ok(isColor(value), `${path}: ${value} не цвет`);
    } else if (Array.isArray(value)) {
      assert.ok(value.length >= 2, `${path}: градиенту нужно ≥ 2 цвета`);
      value.forEach((stop, i) => check(`${path}[${i}]`, stop));
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) check(`${path}.${k}`, v);
    } else {
      assert.fail(`${path}: пусто`);
    }
  };
  for (const [mode, palette] of Object.entries(PALETTES)) check(mode, palette);
});
