/**
 * Рисунок персонажа — медвежонок (режим kid, до 10 лет) и робот (teen: 11+ и
 * взрослые) — в виде данных, без React Native.
 *
 * Почему данные, а не JSX: один и тот же рисунок рисует `HBPet` через
 * react-native-svg и превращается в обычный SVG в тесте и в картинках для
 * владельца. Модуль проверяет `node --test`.
 *
 * Координаты — квадрат 120×120. Слои разделены по тому, что в них двигается:
 * глаза моргают (слой сжимается по вертикали вокруг `eyeY`), рот говорит
 * (сжимается вокруг `mouthY`), остальное неподвижно. Вариант `full` — голова,
 * уменьшенная на `head.s`, над телом; слои лица рисуются в координатах головы.
 *
 * Мелкий размер (`detail: 'low'`, меньше 48 dp) — без градиентов, щёк и бликов,
 * глаза и линии толще: иначе на 24 dp лицо превращается в грязное пятно, а
 * линия в 2.4 единицы становится полупикселем.
 */
import type { PetPalette } from '../../theme/petPalette';

export type CompanionKind = 'bear' | 'robot';
export type PetMood = 'happy' | 'neutral' | 'curious' | 'listening' | 'thinking' | 'sad' | 'sleepy';
export type PetVariant = 'head' | 'full';
export type PetDetail = 'low' | 'high';

export const PET_MOODS: readonly PetMood[] = [
  'happy',
  'neutral',
  'curious',
  'listening',
  'thinking',
  'sad',
  'sleepy',
];

/** Заливка: цвет, `none` или ссылка на градиент из `defs` — `grad:<id>`. */
type Paint = string;

interface Style {
  fill?: Paint;
  stroke?: string;
  sw?: number;
  op?: number;
}

export type Prim =
  | ({ k: 'path'; d: string } & Style)
  | ({ k: 'ellipse'; cx: number; cy: number; rx: number; ry: number } & Style)
  | ({ k: 'rect'; x: number; y: number; w: number; h: number; r: number } & Style);

/** Радиальный градиент в долях рамки фигуры. */
export interface Grad {
  id: string;
  cx: number;
  cy: number;
  r: number;
  stops: [offset: number, color: string][];
}

export interface PetArt {
  defs: Grad[];
  /** Позади головы: тело, лапы, руки (только `full`). */
  body: Prim[];
  /** Голова без лица: уши, голова, морда, антенна, экран. */
  head: Prim[];
  eyes: Prim[];
  mouth: Prim[];
  /** Поверх лица: брови, щёки, «z», дуги звука. */
  over: Prim[];
  /** Где голова внутри квадрата 120: сдвиг и масштаб. У `head` — без изменений. */
  place: { tx: number; ty: number; s: number };
  /** Оси сжатия слоёв, в координатах головы. */
  eyeY: number;
  mouthY: number;
}

export interface PetArtInput {
  kind: CompanionKind;
  mood: PetMood;
  palette: PetPalette;
  variant: PetVariant;
  detail: PetDetail;
  talking: boolean;
}

const INK = '#2E2320';
const MOUTH_DARK = '#4A2E22';
const SCREEN = '#121A3A';  // тёмный экран лица робота — фон взрослого режима
const WHITE = '#FFFFFF';

const line = (d: string, stroke: string, sw: number, op?: number): Prim => ({
  k: 'path',
  d,
  stroke,
  sw,
  fill: 'none',
  op,
});
const dot = (cx: number, cy: number, rx: number, ry: number, fill: Paint, op?: number): Prim => ({
  k: 'ellipse',
  cx,
  cy,
  rx,
  ry,
  fill,
  op,
});

/** «z z» у спящего — две буквы разного размера справа сверху. */
function sleepZ(stroke: string, sw: number): Prim[] {
  return [
    line('M 94 14 H 103 L 94 23 H 103', stroke, sw, 0.6),
    line('M 107 3 H 113 L 107 9 H 113', stroke, sw * 0.8, 0.45),
  ];
}

// ─── Медвежонок ──────────────────────────────────────────────────────────────

function bear({ mood, palette: p, variant, detail, talking }: PetArtInput): PetArt {
  const low = detail === 'low';
  const shade = low ? p.body : 'grad:fur';

  const head: Prim[] = [
    // уши — круглые, с внутренним светлым кругом: по ним медведь узнаётся и на 24 dp
    dot(27, 33, 17, 17, shade),
    dot(93, 33, 17, 17, shade),
    dot(28, 35, low ? 10 : 9.5, low ? 10 : 9.5, p.muzzle),
    dot(92, 35, low ? 10 : 9.5, low ? 10 : 9.5, p.muzzle),
    {
      k: 'path',
      d: 'M 60 24 C 89 24 108 42 108 68 C 108 95 88 110 60 110 C 32 110 12 95 12 68 C 12 42 31 24 60 24 Z',
      fill: shade,
    },
    // светлая морда и нос
    dot(60, 86, low ? 24 : 22, low ? 18 : 16, p.muzzle),
    {
      k: 'path',
      d: low
        ? 'M 50 73 Q 60 67 70 73 Q 69 82 60 84 Q 51 82 50 73 Z'
        : 'M 52 74 Q 60 70 68 74 Q 67 80.5 60 82.5 Q 53 80.5 52 74 Z',
      fill: INK,
    },
  ];
  if (!low) {
    head.push(dot(57, 74.5, 2.4, 1.2, WHITE, 0.55)); // блик на носу
    head.push(dot(40, 38, 15, 6, WHITE, 0.18)); // мягкий блик на лбу
  }

  const eyes: Prim[] = [];
  const over: Prim[] = [];
  const mouth: Prim[] = [];
  const ex = low ? 39 : 41;
  const eRx = low ? 7 : 5.5;
  const eRy = low ? 8 : 6.8;
  const sw = low ? 4.5 : 2.6;

  const openEyes = (dx = 0, dy = 0, scale = 1) => {
    for (const cx of [ex, 120 - ex]) {
      eyes.push(dot(cx + dx, 63 + dy, eRx * scale, eRy * scale, INK));
      if (!low) eyes.push(dot(cx + dx - 1.8, 60.5 + dy, 1.8, 2, WHITE));
    }
  };

  switch (mood) {
    case 'happy':
      openEyes();
      mouth.push(
        low
          ? line('M 49 90 Q 60 99 71 90', INK, sw)
          : line('M 60 82 L 60 86.5 M 49.5 86.5 Q 54.75 93 60 86.5 Q 65.25 93 70.5 86.5', INK, sw),
      );
      break;
    case 'neutral':
      openEyes();
      mouth.push(low ? line('M 52 92 H 68', INK, sw) : line('M 60 82 L 60 87.5 M 53 89.5 Q 60 91.5 67 89.5', INK, sw));
      break;
    case 'curious':
      openEyes(0, 0, 1.08);
      mouth.push(dot(60, 91, low ? 4.5 : 3.4, low ? 5 : 4, MOUTH_DARK));
      if (!low) {
        over.push(line('M 33 50 Q 41 44.5 49 48.5', INK, 2.4));
        over.push(line('M 72 51.5 Q 79 50 86 51.5', INK, 2.4));
      }
      break;
    case 'listening':
      openEyes(0, -0.5, 1.12);
      mouth.push(low ? line('M 53 90 Q 60 95 67 90', INK, sw) : line('M 54 88.5 Q 60 92.5 66 88.5', INK, sw));
      if (!low) {
        // дуги звука у правого уха
        over.push(line('M 110.5 24 Q 114.5 31 110.5 38', INK, 2.2, 0.35));
        over.push(line('M 115 18 Q 120.5 31 115 44', INK, 2.2, 0.2));
      }
      break;
    case 'thinking':
      // взгляд вверх и вбок, бровь приподнята, рот уехал в сторону
      openEyes(2, -3);
      mouth.push(low ? line('M 54 92 Q 62 89 69 92', INK, sw) : line('M 55 90 Q 62 87.5 68 89.5', INK, sw));
      if (!low) over.push(line('M 72 49 Q 80 44 88 47.5', INK, 2.4));
      break;
    case 'sad':
      openEyes(0, 1.5, 0.85);
      mouth.push(low ? line('M 51 95 Q 60 88 69 95', INK, sw) : line('M 52.5 93 Q 60 87 67.5 93', INK, sw));
      if (!low) {
        over.push(line('M 32 53 L 47 48.5', INK, 2.4));
        over.push(line('M 73 48.5 L 88 53', INK, 2.4));
      }
      break;
    case 'sleepy':
      for (const cx of [ex, 120 - ex]) {
        eyes.push(line(`M ${cx - 6.5} 63 Q ${cx} 69 ${cx + 6.5} 63`, INK, sw));
      }
      mouth.push(dot(60, 91, low ? 3.5 : 2.6, low ? 4 : 3, MOUTH_DARK));
      if (!low) over.push(...sleepZ(INK, 2.4));
      break;
  }

  if (talking) {
    mouth.length = 0;
    mouth.push({ k: 'path', d: 'M 50.5 86 Q 60 101 69.5 86 Q 60 90.5 50.5 86 Z', fill: MOUTH_DARK });
    if (!low) mouth.push(dot(60, 93, 4.2, 2.4, p.cheek, 0.9));
  }

  if (!low && mood !== 'sad' && mood !== 'sleepy') {
    over.push(dot(24, 83, 8, 5, p.cheek, 0.42));
    over.push(dot(96, 83, 8, 5, p.cheek, 0.42));
  }

  const body: Prim[] = [];
  let place = { tx: 0, ty: 0, s: 1 };
  if (variant === 'full') {
    place = { tx: 16.5, ty: -10, s: 0.725 };
    body.push(
      // ступни
      dot(43, 112, 12, 7, shade),
      dot(77, 112, 12, 7, shade),
      // тело грушей
      {
        k: 'path',
        d: 'M 60 64 C 83 64 95 84 95 99 C 95 112 81 117 60 117 C 39 117 25 112 25 99 C 25 84 37 64 60 64 Z',
        fill: shade,
      },
      dot(60, 100, 18, 13, p.muzzle),
      // лапки на животе
      dot(44, 96, 8, 8.5, shade),
      dot(76, 96, 8, 8.5, shade),
    );
    if (!low) {
      body.push(dot(43, 113.5, 5, 2.8, p.muzzle, 0.9), dot(77, 113.5, 5, 2.8, p.muzzle, 0.9));
    }
  }

  return {
    defs: low ? [] : [furGradient(p)],
    body,
    head,
    eyes,
    mouth,
    over,
    place,
    eyeY: 63,
    mouthY: talking ? 86 : 89,
  };
}

// ─── Робот ───────────────────────────────────────────────────────────────────

function robot({ mood, palette: p, variant, detail, talking }: PetArtInput): PetArt {
  const low = detail === 'low';
  const shade = low ? p.body : 'grad:fur';
  const glow = p.glow;

  const head: Prim[] = [
    // антенна
    { k: 'rect', x: low ? 56.5 : 58, y: 12, w: low ? 7 : 4, h: 18, r: 2, fill: p.deep },
    dot(60, 12, low ? 9 : 7, low ? 9 : 7, low ? p.cheek : 'grad:bulb'),
    // боковые «уши»
    { k: 'rect', x: 6, y: 52, w: 12, h: 30, r: 5, fill: p.deep },
    { k: 'rect', x: 102, y: 52, w: 12, h: 30, r: 5, fill: p.deep },
    // голова
    { k: 'rect', x: 13, y: 26, w: 94, h: 82, r: 27, fill: shade },
    // тёмный экран лица
    { k: 'rect', x: 24, y: 42, w: 72, h: 52, r: 18, fill: SCREEN },
  ];
  if (!low) {
    head.push({ k: 'rect', x: 30, y: 45, w: 36, h: 5, r: 2.5, fill: WHITE, op: 0.08 }); // отблеск стекла
    head.push(dot(38, 34, 13, 4.5, WHITE, 0.2));
  }

  const eyes: Prim[] = [];
  const mouth: Prim[] = [];
  const over: Prim[] = [];
  const ex = 45;
  const sw = low ? 5 : 3.2;
  const round = (rx: number, ry: number, dx = 0, dy = 0) => {
    for (const cx of [ex, 120 - ex]) eyes.push(dot(cx + dx, 64 + dy, low ? rx * 1.3 : rx, low ? ry * 1.2 : ry, glow));
  };

  switch (mood) {
    case 'happy':
      round(6, 7.5);
      mouth.push(line('M 51 79 Q 60 87 69 79', glow, sw));
      break;
    case 'neutral':
      for (const cx of [ex, 120 - ex]) eyes.push({ k: 'rect', x: cx - 5.5, y: 57, w: 11, h: 14, r: 5, fill: glow });
      mouth.push(line('M 52 81 H 68', glow, sw));
      break;
    case 'curious':
      eyes.push(dot(ex, 63, low ? 9 : 7.2, low ? 10 : 8.6, glow));
      eyes.push(dot(120 - ex, 65, low ? 6.5 : 5, low ? 7.5 : 6, glow));
      mouth.push({ k: 'ellipse', cx: 60, cy: 82, rx: 3.6, ry: 3.6, fill: 'none', stroke: glow, sw: low ? 4 : 2.6 });
      break;
    case 'listening':
      round(6.5, 8.2, 0, -1);
      mouth.push(line('M 55 81 Q 60 84 65 81', glow, sw));
      if (!low) {
        over.push({ k: 'ellipse', cx: 60, cy: 12, rx: 11.5, ry: 11.5, fill: 'none', stroke: p.cheek, sw: 2, op: 0.45 });
        over.push({ k: 'ellipse', cx: 60, cy: 12, rx: 16, ry: 16, fill: 'none', stroke: p.cheek, sw: 1.6, op: 0.2 });
      }
      break;
    case 'thinking':
      for (const cx of [ex, 120 - ex]) eyes.push({ k: 'rect', x: cx - 4, y: 57, w: 12, h: 7, r: 3.5, fill: glow });
      for (const cx of [52, 60, 68]) mouth.push(dot(cx, 81, low ? 3 : 2.1, low ? 3 : 2.1, glow));
      break;
    case 'sad':
      for (const cx of [ex, 120 - ex]) {
        // верх глаза срезан: у переносицы выше, к краю ниже — грустный излом
        // (наоборот получается сердитый)
        const out = cx < 60 ? -1 : 1;
        eyes.push({
          k: 'path',
          d: `M ${cx + 6 * out} 64 L ${cx - 6 * out} 59.5 Q ${cx - 6 * out} 71 ${cx} 71 Q ${cx + 6 * out} 71 ${cx + 6 * out} 64 Z`,
          fill: glow,
        });
      }
      mouth.push(line('M 52 84 Q 60 78 68 84', glow, sw));
      break;
    case 'sleepy':
      for (const cx of [ex, 120 - ex]) eyes.push(line(`M ${cx - 6} 66 H ${cx + 6}`, glow, sw));
      mouth.push(line('M 56 82 H 64', glow, sw * 0.8));
      if (!low) over.push(...sleepZ(p.deep, 2.4));
      break;
  }

  if (talking) {
    mouth.length = 0;
    mouth.push({ k: 'rect', x: 50, y: 76.5, w: 20, h: 9, r: 4.5, fill: glow });
  }

  if (!low && (mood === 'happy' || mood === 'listening')) {
    over.push(dot(33, 78, 4, 2.4, p.cheek, 0.8));
    over.push(dot(87, 78, 4, 2.4, p.cheek, 0.8));
  }

  const body: Prim[] = [];
  let place = { tx: 0, ty: 0, s: 1 };
  if (variant === 'full') {
    // голова крупнее тела: иначе робот читается как шкаф, а не как персонаж
    place = { tx: 13.2, ty: -3, s: 0.78 };
    body.push(
      // руки-капсулы
      { k: 'rect', x: 19, y: 83, w: 12, h: 26, r: 6, fill: p.deep },
      { k: 'rect', x: 89, y: 83, w: 12, h: 26, r: 6, fill: p.deep },
      // корпус
      { k: 'rect', x: 31, y: 76, w: 58, h: 41, r: 16, fill: shade },
      // огонёк на груди
      dot(60, 99, low ? 7 : 6, low ? 7 : 6, SCREEN),
      dot(60, 99, low ? 4 : 3.5, low ? 4 : 3.5, glow),
    );
  }

  return {
    defs: low
      ? []
      : [
          furGradient(p),
          { id: 'bulb', cx: 0.4, cy: 0.35, r: 0.7, stops: [[0, WHITE], [0.45, p.cheek], [1, p.deep]] },
        ],
    body,
    head,
    eyes,
    mouth,
    over,
    place,
    eyeY: 64,
    mouthY: 81,
  };
}

function furGradient(p: PetPalette): Grad {
  return { id: 'fur', cx: 0.38, cy: 0.3, r: 0.75, stops: [[0, p.light], [0.55, p.body], [1, p.deep]] };
}

/**
 * Корпус робота — холодный и нейтральный, как в макете D: светло-синий пластик,
 * тёмный экран лица, мятное свечение глаз, золотая лампочка антенны.
 *
 * Выбранный ребёнком оттенок на робота не переносится намеренно. Цвет выбирают
 * в комнате питомца, а это детский путь: у одиннадцатилетнего, которому достаётся
 * робот, в сторе лежит оттенок по умолчанию (мёд), и робот выходил бы бежевым
 * вместо холодного корпуса из макета.
 */
const ROBOT_PALETTE: PetPalette = {
  light: '#F4F7FF',
  body: '#E4EAFF',
  deep: '#C9D5FF',
  cheek: '#FFC93C',
  muzzle: '#FFFFFF',
  glow: '#3DE0D0',
};

export function petArt(input: PetArtInput): PetArt {
  return input.kind === 'robot'
    ? robot({ ...input, palette: ROBOT_PALETTE })
    : bear(input);
}

/** Мелкий размер рисуется упрощённо. Порог — из плана редизайна (раздел C). */
export const LOW_DETAIL_BELOW = 48;
/**
 * Тело появляется с этого размера. В плане стояло 64, но на картинках фигурка в
 * 64–96 dp — это мелкое лицо над туловищем; в шапках, карточках и пустых
 * состояниях голова читается лучше. Целиком — только герои экранов.
 */
export const FULL_BODY_FROM = 100;

// ─── SVG-строка — для теста и картинок владельцу ─────────────────────────────

function paint(v: string | undefined, uid: string): string | undefined {
  if (!v) return undefined;
  return v.startsWith('grad:') ? `url(#${uid}${v.slice(5)})` : v;
}

function primToSvg(p: Prim, uid: string): string {
  const attrs: string[] = [];
  const fill = paint(p.fill, uid);
  if (fill) attrs.push(`fill="${fill}"`);
  if (p.stroke) attrs.push(`stroke="${p.stroke}" stroke-width="${p.sw ?? 1}" stroke-linecap="round" stroke-linejoin="round"`);
  if (p.op !== undefined) attrs.push(`opacity="${p.op}"`);
  const a = attrs.join(' ');
  switch (p.k) {
    case 'path':
      return `<path d="${p.d}" ${a}/>`;
    case 'ellipse':
      return `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" ${a}/>`;
    case 'rect':
      return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.r}" ${a}/>`;
  }
}

export function petArtToSvg(art: PetArt, size: number, uid = 'p'): string {
  const defs = art.defs
    .map(
      (g) =>
        `<radialGradient id="${uid}${g.id}" cx="${g.cx}" cy="${g.cy}" r="${g.r}">${g.stops
          .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`)
          .join('')}</radialGradient>`,
    )
    .join('');
  const draw = (list: Prim[]) => list.map((p) => primToSvg(p, uid)).join('');
  const { tx, ty, s } = art.place;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120">` +
    `<defs>${defs}</defs>${draw(art.body)}` +
    `<g transform="translate(${tx} ${ty}) scale(${s})">${draw(art.head)}${draw(art.eyes)}${draw(art.mouth)}${draw(art.over)}</g>` +
    `</svg>`
  );
}
