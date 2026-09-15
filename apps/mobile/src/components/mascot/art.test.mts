/**
 * Рисунок персонажа: у каждого сочетания есть лицо, мелкий размер без
 * градиентов, «говорит» открывает рот, робот и медвежонок различаются.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { PET_MOODS, petArt, petArtToSvg } = await import('./art.js');
const { PET_HUES, petPaletteFor, nearestPetHue } = await import('../../theme/petPalette.js');

const KINDS = ['bear', 'robot'] as const;
const art = (over: Record<string, unknown> = {}) =>
  petArt({
    kind: 'bear',
    mood: 'happy',
    palette: petPaletteFor(55),
    variant: 'head',
    detail: 'high',
    talking: false,
    ...over,
  });

describe('petArt', () => {
  it('у каждого персонажа в каждом настроении есть глаза и рот', () => {
    for (const kind of KINDS) {
      for (const mood of PET_MOODS) {
        for (const detail of ['low', 'high']) {
          const a = art({ kind, mood, detail });
          assert.ok(a.eyes.length > 0, `${kind}/${mood}/${detail}: нет глаз`);
          assert.ok(a.mouth.length > 0, `${kind}/${mood}/${detail}: нет рта`);
        }
      }
    }
  });

  it('мелкий размер рисуется без градиентов, крупный — с ними', () => {
    for (const kind of KINDS) {
      const low = art({ kind, detail: 'low' });
      assert.equal(low.defs.length, 0);
      const all = [...low.body, ...low.head, ...low.eyes, ...low.mouth, ...low.over];
      assert.ok(all.every((p) => !p.fill?.startsWith('grad:')), `${kind}: градиент на мелком размере`);
      assert.ok(art({ kind }).defs.length > 0);
    }
  });

  it('каждая ссылка на градиент ведёт на объявленный градиент', () => {
    for (const kind of KINDS) {
      for (const variant of ['head', 'full']) {
        const a = art({ kind, variant });
        const ids = new Set(a.defs.map((g) => g.id));
        for (const p of [...a.body, ...a.head, ...a.eyes, ...a.mouth, ...a.over]) {
          if (p.fill?.startsWith('grad:')) assert.ok(ids.has(p.fill.slice(5)), `${kind}: ${p.fill}`);
        }
      }
    }
  });

  it('«говорит» меняет рот, а не глаза', () => {
    for (const kind of KINDS) {
      const quiet = art({ kind });
      const talking = art({ kind, talking: true });
      assert.deepEqual(talking.eyes, quiet.eyes);
      assert.notDeepEqual(talking.mouth, quiet.mouth);
    }
  });

  it('тело есть только у фигурки целиком, и голова тогда уменьшена', () => {
    for (const kind of KINDS) {
      assert.equal(art({ kind }).body.length, 0);
      const full = art({ kind, variant: 'full' });
      assert.ok(full.body.length > 0);
      assert.ok(full.place.s < 1);
    }
  });

  it('медвежонок и робот — разные рисунки', () => {
    assert.notDeepEqual(art({ kind: 'bear' }).head, art({ kind: 'robot' }).head);
  });

  it('SVG-строка использует переданный префикс id', () => {
    const svg = petArtToSvg(art(), 96, 'x1');
    assert.match(svg, /id="x1fur"/);
    assert.match(svg, /url\(#x1fur\)/);
  });
});

describe('petPalette', () => {
  it('любое число сводится к одному из семи оттенков', () => {
    assert.equal(nearestPetHue(55), 55);
    assert.equal(nearestPetHue(60), 55);
    assert.equal(nearestPetHue(340), 350);
    assert.equal(nearestPetHue(-10), 25);
    for (const h of PET_HUES) assert.ok(petPaletteFor(h).glow);
  });
});
