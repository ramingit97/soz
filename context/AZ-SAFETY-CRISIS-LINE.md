# Azerbaijan crisis line — verified finding (для AZ_CRISIS_LINE)

**Дата: 2026-07-03. Требует финального подтверждения основателя перед включением.**

## TL;DR — рекомендация
Установить **`116 111`** (Azerbaijan Child Helpline) как `AZ_CRISIS_LINE`.
Это одно-строчное изменение, но **безопасностно-критичное** (номер зачитывается
ребёнку в кризисной ситуации), поэтому я НЕ включил его сам — код помечен
`TODO(founder)` и правило «никогда не читать неверный номер». Ниже — доказательная
база; если основатель подтверждает, замена ниже.

## Что за номер
**116 111 — Azerbaijan Child Helpline (Uşaq qaynar xətti).**
- Работает 24/7, бесплатно, конфиденциально, на азербайджанском.
- Поддержка детей/подростков: насилие и домашнее насилие, буллинг, школа,
  сексуальное насилие, эмоциональная поддержка.
- Оператор/спонсор: **Azercell** (официальная страница проекта).
- SMS-резерв (по данным findahelpline): +994 51-580-22-80, +994 51-880-11-80,
  +994 51-880-22-80.
- `116 111` — общеевропейский гармонизированный код детской линии (тот же, что в ЕС),
  что повышает доверие к находке.

## Точное изменение (после подтверждения)
`apps/api/src/ai/safety.ts`:
```ts
// было:
export const AZ_CRISIS_LINE: string | null = null;
// станет:
export const AZ_CRISIS_LINE: string | null = '116 111';
```
`safeCrisisReply(language)` уже читает `AZ_CRISIS_LINE` и вплетает его в спокойный
безопасный ответ, если он не null — больше ничего менять не нужно. Прогнать
`cd apps/api && npx tsc --noEmit` (тривиально green) и живьём проверить, что при
crisis-триггере номер произносится корректно в EN и RU ответах.

## Перед включением (чек основателя, 5 минут)
1. Позвонить на 116 111 из азербайджанского номера — убедиться, что линия жива и
   отвечает как детская служба (номера меняются; мы обещали «только верифицированный»).
2. Решить формулировку: читать ли номер младшим (5-7) или только направлять к
   взрослому + показывать номер родителю. Текущий `safeCrisisReply` — единый; при
   желании можно ветвить по ageBand.
3. Зафиксировать источник и дату проверки здесь.

## Источники
- [Children Hotline 116-111 | Azercell (официальный оператор)](https://www.azercell.com/en/about-us/azercell-korporativ-sosial-mesuliyyet/azercell-sosial-layihelerimiz/usaq-qaynar-xetti-116-111.html)
- [Azerbaijan Child Helpline — Child Helpline International](https://childhelplineinternational.org/azerbaijan-azerbaijan-child-helpline/)
- [Azerbaijan Child Helpline Service — findahelpline](https://findahelpline.com/organizations/azerbaijan-child-helpline-service)
- [Azerbaijan helplines — findahelpline](https://findahelpline.com/countries/az)
