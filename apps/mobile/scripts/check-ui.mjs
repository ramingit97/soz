#!/usr/bin/env node
/**
 * Счётчик UI-долга редизайна (context/PLAN-REDESIGN-2026-09-13.md, раздел G).
 *
 * Считает по app/ и src/ то, от чего редизайн уходит: сырые размеры шрифта,
 * центрирование, эмодзи вместо иконок, лишние глубокие тени, старый маскот,
 * системные алерты, жёсткие верхние отступы, развилки по режиму в экранах.
 * Это эвристика на регулярках, а не парсер: цель — видеть направление, а не
 * точное число.
 *
 *   node scripts/check-ui.mjs            итоги и по пять худших файлов на метрику
 *   node scripts/check-ui.mjs --files    полная разбивка по файлам
 *   node scripts/check-ui.mjs --check    сравнить с scripts/ui-baseline.json,
 *                                        упасть, если любая метрика выросла
 *   node scripts/check-ui.mjs --update   записать текущие итоги как базовую линию
 *
 * После батча, который метрику уменьшил, запускать `--update`, чтобы храповик
 * не дал ей вырасти обратно.
 *
 * НЕ добавлять в `scripts` package.json: этот раздел входит в отпечаток нативной
 * части, и новая строка отрезала бы установленные сборки от EAS Update
 * (RELEASE.md, раздел про EAS Update).
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'scripts', 'ui-baseline.json');

/** Файлы, где эмодзи — это контент (уроки, сказки, реплики Хани), а не иконки. */
const EMOJI_CONTENT_ALLOWLIST = new Set([
  'src/data/lessons.ts',
  'src/data/boboHouse.ts',
  'app/story.tsx',
]);

const METRICS = {
  rawFontSize: {
    label: 'сырой fontSize (число вместо токена)',
    re: /fontSize:\s*\d/g,
  },
  textAlignCenter: {
    label: "textAlign: 'center'",
    re: /textAlign:\s*['"]center['"]/g,
  },
  emojiOnlyText: {
    label: '<Text> из одного эмодзи (иконка-эмодзи)',
    re: /<Text\b[^>]*>\s*(?:\{\s*['"`])?(?=[^<]*\p{Extended_Pictographic})(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200D|\uFE0F|\s)+(?:['"`]\s*\})?\s*<\/Text>/gu,
    skip: (file) => EMOJI_CONTENT_ALLOWLIST.has(file),
  },
  deepShadow: {
    label: 'depth="deep" (один главный блок на экран)',
    re: /depth="deep"/g,
  },
  bobo: {
    label: '<Bobo> (старый маскот)',
    re: /<Bobo\b/g,
  },
  alert: {
    label: 'Alert.alert (вместо инлайн-баннера)',
    re: /Alert\.alert\(/g,
  },
  paddingTopLarge: {
    label: 'paddingTop ≥ 40 (вместо safe-area)',
    re: /paddingTop:\s*(?:[4-9]\d|\d{3,})\b/g,
  },
  modeBranch: {
    label: 'развилка mode === (вместо токенов)',
    re: /\bmode\s*[!=]==\s*['"](?:kid|teen)['"]/g,
  },
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

function measure() {
  const totals = Object.fromEntries(Object.keys(METRICS).map((k) => [k, 0]));
  const byFile = {};
  const files = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'src'))];
  for (const full of files) {
    const file = relative(ROOT, full).split('\\').join('/');
    const src = readFileSync(full, 'utf8');
    for (const [key, m] of Object.entries(METRICS)) {
      if (m.skip?.(file)) continue;
      const n = src.match(m.re)?.length ?? 0;
      if (!n) continue;
      totals[key] += n;
      (byFile[file] ??= {})[key] = n;
    }
  }
  return { totals, byFile };
}

function printTotals(totals, baseline) {
  for (const [key, m] of Object.entries(METRICS)) {
    const now = totals[key];
    const was = baseline?.[key];
    const delta = was === undefined ? '' : now === was ? '  =' : now > was ? `  +${now - was}` : `  −${was - now}`;
    console.log(`${String(now).padStart(5)}  ${key.padEnd(16)} ${m.label}${delta}`);
  }
}

function printWorst(byFile, limit) {
  for (const key of Object.keys(METRICS)) {
    const rows = Object.entries(byFile)
      .filter(([, v]) => v[key])
      .sort((a, b) => b[1][key] - a[1][key]);
    if (!rows.length) continue;
    console.log(`\n${key}:`);
    for (const [file, v] of limit ? rows.slice(0, limit) : rows) {
      console.log(`${String(v[key]).padStart(5)}  ${file}`);
    }
  }
}

const args = new Set(process.argv.slice(2));
const { totals, byFile } = measure();

if (args.has('--update')) {
  writeFileSync(BASELINE, `${JSON.stringify(totals, null, 2)}\n`);
  printTotals(totals);
  console.log(`\nБазовая линия записана: ${relative(process.cwd(), BASELINE)}`);
} else if (args.has('--check')) {
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
  } catch {
    console.error('Нет scripts/ui-baseline.json — сначала запустить с --update.');
    process.exit(2);
  }
  printTotals(totals, baseline);
  const grown = Object.keys(METRICS).filter((k) => totals[k] > (baseline[k] ?? 0));
  if (grown.length) {
    console.error(`\nВыросло: ${grown.join(', ')}. Где именно — node scripts/check-ui.mjs --files`);
    process.exit(1);
  }
  const shrunk = Object.keys(METRICS).filter((k) => totals[k] < (baseline[k] ?? 0));
  console.log(shrunk.length ? '\nОК. Уменьшилось — обновить базовую линию: --update' : '\nОК.');
} else {
  printTotals(totals);
  printWorst(byFile, args.has('--files') ? 0 : 5);
}
