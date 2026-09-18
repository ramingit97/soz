/**
 * PUT /children/:id против НАСТОЯЩЕЙ базы: чужой пользователь не может изменить
 * профиль ребёнка.
 *
 * До 2026-09-18 ручка сначала обновляла строку по одному id, а владельца
 * проверяла потом, по вернувшейся строке: ответ был 404, но имя, день и звёзды
 * чужого ребёнка уже были перезаписаны. Мок базы этого бы не поймал — ошибка в
 * порядке запросов.
 *
 * Требует DATABASE_URL, без неё пропускается (как `progress.integration.test.ts`).
 * Создаёт двух временных пользователей и удаляет их в конце.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import 'dotenv/config';
import { eq, inArray } from 'drizzle-orm';

import { app } from '../app.js';
import { signToken } from '../auth/jwt.js';
import { closeDb, getDb, isDbAvailable } from '../db/client.js';
import { children, users } from '../db/schema.js';

const hasDb = isDbAvailable();

describe('PUT /children/:id', { skip: hasDb ? false : 'DATABASE_URL not set' }, () => {
  const userIds: string[] = [];
  let ownerToken: string;
  let strangerToken: string;
  let childId: string;

  const put = (token: string, body: Record<string, unknown>) =>
    app.request(`/children/${childId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  const childName = async () => {
    const [row] = await getDb().select({ name: children.name }).from(children).where(eq(children.id, childId));
    return row?.name;
  };

  before(async () => {
    const db = getDb();
    const stamp = Date.now();
    const [owner, stranger] = await db
      .insert(users)
      .values([
        { email: `test-children-owner-${stamp}@guest.invalid`, passwordHash: 'x', isGuest: 1 },
        { email: `test-children-stranger-${stamp}@guest.invalid`, passwordHash: 'x', isGuest: 1 },
      ])
      .returning({ id: users.id, email: users.email });
    userIds.push(owner!.id, stranger!.id);
    ownerToken = await signToken({ userId: owner!.id, email: owner!.email });
    strangerToken = await signToken({ userId: stranger!.id, email: stranger!.email });

    const [kid] = await db
      .insert(children)
      .values({ userId: owner!.id, name: 'Ayla', age: 7, learningLanguages: ['en'] })
      .returning({ id: children.id });
    childId = kid!.id;
  });

  after(async () => {
    // Дети удаляются каскадом вместе с пользователем.
    if (userIds.length) await getDb().delete(users).where(inArray(users.id, userIds));
    await closeDb();
  });

  it('чужой пользователь получает 404 и ничего не меняет', async () => {
    const res = await put(strangerToken, { name: 'Hacked', currentDay: 30 });
    assert.equal(res.status, 404);
    assert.equal(await childName(), 'Ayla');
  });

  it('владелец меняет профиль', async () => {
    const res = await put(ownerToken, { name: 'Aylin' });
    assert.equal(res.status, 200);
    assert.equal(await childName(), 'Aylin');
  });

  // Смена уровня (POST /preferences). Успешный путь здесь не проверяется: он
  // пересобирает будущие уроки через LLM. Проверяются отказы — они срабатывают
  // до записи и до генерации.
  const postPrefs = (token: string, body: Record<string, unknown>) =>
    app.request(`/children/${childId}/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  const childLevel = async () => {
    const [row] = await getDb().select({ level: children.level }).from(children).where(eq(children.id, childId));
    return row?.level;
  };

  it('чужой пользователь не меняет уровень', async () => {
    const res = await postPrefs(strangerToken, { level: 'intermediate' });
    assert.equal(res.status, 403);
    assert.equal(await childLevel(), 'beginner');
  });

  it('неизвестный уровень отклоняется', async () => {
    const res = await postPrefs(ownerToken, { level: 'native' });
    assert.equal(res.status, 400);
    assert.equal(await childLevel(), 'beginner');
  });
});
