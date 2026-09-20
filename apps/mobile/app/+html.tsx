/**
 * Корневой HTML веб-версии. Используется только при веб-экспорте — нативное
 * приложение этот файл не читает, отпечаток runtime от него не зависит.
 *
 * Каждая строка стилей чинит то, что владелец увидел в Safari на iPhone
 * (2026-09-14, экран имени ребёнка после тапа по полю):
 *
 *  - `#root { overflow: hidden }` — декоративные круги `Screen` (360 dp,
 *    `right: -120`) и похожие абсолютные подложки выходят за край экрана.
 *    Мобильный браузер растягивал страницу до 496 px вместо 375 и уменьшал её,
 *    а с открытой клавиатурой справа и снизу проступала пустая область.
 *  - фон `html, body` кремовый — если Safari всё же сдвинет страницу при
 *    клавиатуре, под ней не белое.
 *  - `outline: none` у полей — браузер рисовал синий прямоугольник фокуса
 *    внутри нашей оранжевой рамки.
 *  - `maximum-scale=1` — Safari не увеличивает страницу при фокусе на поле.
 *  - `100dvh` — в iOS Safari `100%` высоты считается вместе с нижней панелью
 *    браузера, и кнопка микрофона внизу урока уходила под неё наполовину.
 *    Динамическая высота — это видимая часть экрана.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { PALETTES } from '@/theme/palettes';

const webFixes = `
html, body { background-color: ${PALETTES.kid.bg}; overscroll-behavior: none; }
#root { overflow: hidden; }
html, body, #root { height: 100dvh; }
input:focus, textarea:focus { outline: none; }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: webFixes }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
