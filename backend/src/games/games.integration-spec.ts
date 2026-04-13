import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import Redis from 'ioredis';
import { createTestApp, clearAll, BGG_GAME_FIXTURE } from '../test/app-factory';
import { GameStatus } from './entities/collection-item.entity';

describe('GamesController (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redis: Redis;

  const REGISTER_URL = '/api/auth/register';
  const COLLECTION_URL = '/api/games/collection';
  const FOR_TRADE_URL = '/api/games/for-trade';

  const alice = { email: 'alice@example.com', username: 'alice', password: 'Password123!' };
  const bob = { email: 'bob@example.com', username: 'bob', password: 'Password123!' };

  /** Register a user and return their access token. */
  async function registerUser(dto: typeof alice): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(REGISTER_URL)
      .send(dto);
    return res.body.accessToken as string;
  }

  /** Add the BGG fixture game to the collection and return the entry. */
  async function addGame(
    token: string,
    status: GameStatus = GameStatus.IN_COLLECTION,
  ): Promise<{ id: string; bggGameId: string; name: string; status: GameStatus }> {
    const res = await request(app.getHttpServer())
      .post(COLLECTION_URL)
      .set('Authorization', `Bearer ${token}`)
      .send({ bggGameId: BGG_GAME_FIXTURE.id, status });
    return res.body;
  }

  beforeAll(async () => {
    ({ app, dataSource, redis } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await clearAll(dataSource, redis);
  });

  // ─── GET /api/games/collection ────────────────────────────────

  describe('GET /api/games/collection', () => {
    it('returns an empty array for a newly registered user', async () => {
      const token = await registerUser(alice);

      const res = await request(app.getHttpServer())
        .get(COLLECTION_URL)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('returns 401 when no token is provided', async () => {
      await request(app.getHttpServer()).get(COLLECTION_URL).expect(401);
    });
  });

  // ─── POST /api/games/collection ───────────────────────────────

  describe('POST /api/games/collection', () => {
    it('adds a game and returns the collection entry', async () => {
      const token = await registerUser(alice);

      const res = await request(app.getHttpServer())
        .post(COLLECTION_URL)
        .set('Authorization', `Bearer ${token}`)
        .send({ bggGameId: BGG_GAME_FIXTURE.id })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        bggGameId: BGG_GAME_FIXTURE.id,
        name: BGG_GAME_FIXTURE.name,
        status: GameStatus.IN_COLLECTION,
      });
    });

    it('stores the game in the database and it appears in the collection', async () => {
      const token = await registerUser(alice);
      await addGame(token);

      const res = await request(app.getHttpServer())
        .get(COLLECTION_URL)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        bggGameId: BGG_GAME_FIXTURE.id,
        name: BGG_GAME_FIXTURE.name,
      });
    });

    it('returns 409 when the same game is added twice', async () => {
      const token = await registerUser(alice);
      await addGame(token);

      await request(app.getHttpServer())
        .post(COLLECTION_URL)
        .set('Authorization', `Bearer ${token}`)
        .send({ bggGameId: BGG_GAME_FIXTURE.id })
        .expect(409);
    });

    it('accepts an explicit status on creation', async () => {
      const token = await registerUser(alice);

      const res = await request(app.getHttpServer())
        .post(COLLECTION_URL)
        .set('Authorization', `Bearer ${token}`)
        .send({ bggGameId: BGG_GAME_FIXTURE.id, status: GameStatus.WISHLIST })
        .expect(201);

      expect(res.body.status).toBe(GameStatus.WISHLIST);
    });
  });

  // ─── PATCH /api/games/collection/:id ─────────────────────────

  describe('PATCH /api/games/collection/:id', () => {
    it('updates the status of a collection entry', async () => {
      const token = await registerUser(alice);
      const item = await addGame(token);

      const res = await request(app.getHttpServer())
        .patch(`${COLLECTION_URL}/${item.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: GameStatus.FOR_TRADE })
        .expect(200);

      expect(res.body.status).toBe(GameStatus.FOR_TRADE);
    });

    it('returns 404 for a non-existent entry', async () => {
      const token = await registerUser(alice);

      await request(app.getHttpServer())
        .patch(`${COLLECTION_URL}/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: GameStatus.FOR_TRADE })
        .expect(404);
    });

    it("returns 404 when trying to update another user's entry", async () => {
      const aliceToken = await registerUser(alice);
      const bobToken = await registerUser(bob);
      const item = await addGame(aliceToken);

      await request(app.getHttpServer())
        .patch(`${COLLECTION_URL}/${item.id}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ status: GameStatus.FOR_TRADE })
        .expect(404);
    });
  });

  // ─── GET /api/games/for-trade ─────────────────────────────────

  describe('GET /api/games/for-trade', () => {
    it("shows other users' FOR_TRADE games but not the requesting user's own", async () => {
      const aliceToken = await registerUser(alice);
      const bobToken = await registerUser(bob);

      await addGame(aliceToken, GameStatus.FOR_TRADE);
      await addGame(bobToken, GameStatus.FOR_TRADE);

      const res = await request(app.getHttpServer())
        .get(FOR_TRADE_URL)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        bggGameId: BGG_GAME_FIXTURE.id,
        status: GameStatus.FOR_TRADE,
      });
    });

    it('does not include IN_COLLECTION games from other users', async () => {
      const aliceToken = await registerUser(alice);
      const bobToken = await registerUser(bob);

      await addGame(bobToken, GameStatus.IN_COLLECTION);

      const res = await request(app.getHttpServer())
        .get(FOR_TRADE_URL)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200);

      expect(res.body).toHaveLength(0);
    });
  });

  // ─── DELETE /api/games/collection/:id ────────────────────────

  describe('DELETE /api/games/collection/:id', () => {
    it('removes the entry and the collection becomes empty', async () => {
      const token = await registerUser(alice);
      const item = await addGame(token);

      await request(app.getHttpServer())
        .delete(`${COLLECTION_URL}/${item.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const { body } = await request(app.getHttpServer())
        .get(COLLECTION_URL)
        .set('Authorization', `Bearer ${token}`);

      expect(body).toHaveLength(0);
    });

    it('returns 404 for a non-existent entry', async () => {
      const token = await registerUser(alice);

      await request(app.getHttpServer())
        .delete(`${COLLECTION_URL}/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it("returns 404 when trying to delete another user's entry", async () => {
      const aliceToken = await registerUser(alice);
      const bobToken = await registerUser(bob);
      const item = await addGame(aliceToken);

      await request(app.getHttpServer())
        .delete(`${COLLECTION_URL}/${item.id}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .expect(404);
    });
  });
});
