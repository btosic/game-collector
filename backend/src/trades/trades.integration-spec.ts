import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import Redis from 'ioredis';
import { createTestApp, clearAll } from '../test/app-factory';
import { TradeStatus } from './entities/trade.entity';

describe('TradesController (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redis: Redis;

  const REGISTER_URL = '/api/auth/register';
  const TRADES_URL = '/api/trades';
  const ME_URL = '/api/users/me';

  const aliceDto = { email: 'alice@example.com', username: 'alice', password: 'Password123!' };
  const bobDto = { email: 'bob@example.com', username: 'bob', password: 'Password123!' };

  interface UserCtx {
    token: string;
    id: string;
  }

  /** Register a user and return their token + resolved user id. */
  async function registerUser(dto: typeof aliceDto): Promise<UserCtx> {
    const regRes = await request(app.getHttpServer())
      .post(REGISTER_URL)
      .send(dto);
    const token = regRes.body.accessToken as string;

    const meRes = await request(app.getHttpServer())
      .get(ME_URL)
      .set('Authorization', `Bearer ${token}`);
    const id = meRes.body.id as string;

    return { token, id };
  }

  /** Create a trade from alice (requester) to bob (receiver). */
  async function createTrade(
    requesterToken: string,
    receiverId: string,
  ): Promise<{ id: string; status: TradeStatus }> {
    const res = await request(app.getHttpServer())
      .post(TRADES_URL)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        receiverId,
        offeredGameId: 'game-alice-1',
        offeredGameName: 'Gloomhaven',
        requestedGameId: 'game-bob-1',
        requestedGameName: 'Pandemic',
      })
      .expect(201);
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

  // ─── POST /api/trades ─────────────────────────────────────────

  describe('POST /api/trades', () => {
    it('creates a PENDING trade and returns it', async () => {
      const alice = await registerUser(aliceDto);
      const bob = await registerUser(bobDto);

      const res = await request(app.getHttpServer())
        .post(TRADES_URL)
        .set('Authorization', `Bearer ${alice.token}`)
        .send({
          receiverId: bob.id,
          offeredGameId: 'game-alice-1',
          offeredGameName: 'Gloomhaven',
          requestedGameId: 'game-bob-1',
          requestedGameName: 'Pandemic',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        requesterId: alice.id,
        receiverId: bob.id,
        offeredGameName: 'Gloomhaven',
        requestedGameName: 'Pandemic',
        status: TradeStatus.PENDING,
      });
    });

    it('returns 400 when required fields are missing', async () => {
      const alice = await registerUser(aliceDto);

      await request(app.getHttpServer())
        .post(TRADES_URL)
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ offeredGameName: 'Gloomhaven' })
        .expect(400);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .post(TRADES_URL)
        .send({})
        .expect(401);
    });
  });

  // ─── GET /api/trades/mine ─────────────────────────────────────

  describe('GET /api/trades/mine', () => {
    it('returns trades for the requester', async () => {
      const alice = await registerUser(aliceDto);
      const bob = await registerUser(bobDto);
      await createTrade(alice.token, bob.id);

      const res = await request(app.getHttpServer())
        .get(`${TRADES_URL}/mine`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].requesterId).toBe(alice.id);
    });

    it('returns trades for the receiver as well', async () => {
      const alice = await registerUser(aliceDto);
      const bob = await registerUser(bobDto);
      await createTrade(alice.token, bob.id);

      const res = await request(app.getHttpServer())
        .get(`${TRADES_URL}/mine`)
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].receiverId).toBe(bob.id);
    });

    it('returns an empty array when the user has no trades', async () => {
      const alice = await registerUser(aliceDto);

      const res = await request(app.getHttpServer())
        .get(`${TRADES_URL}/mine`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      expect(res.body).toHaveLength(0);
    });
  });

  // ─── PATCH /api/trades/:id/respond ───────────────────────────

  describe('PATCH /api/trades/:id/respond', () => {
    it('receiver accepts the trade → status becomes ACCEPTED', async () => {
      const alice = await registerUser(aliceDto);
      const bob = await registerUser(bobDto);
      const trade = await createTrade(alice.token, bob.id);

      const res = await request(app.getHttpServer())
        .patch(`${TRADES_URL}/${trade.id}/respond`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ accept: true })
        .expect(200);

      expect(res.body.status).toBe(TradeStatus.ACCEPTED);
    });

    it('receiver declines the trade → status becomes DECLINED', async () => {
      const alice = await registerUser(aliceDto);
      const bob = await registerUser(bobDto);
      const trade = await createTrade(alice.token, bob.id);

      const res = await request(app.getHttpServer())
        .patch(`${TRADES_URL}/${trade.id}/respond`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ accept: false })
        .expect(200);

      expect(res.body.status).toBe(TradeStatus.DECLINED);
    });

    it('returns 403 when the requester tries to respond to their own trade', async () => {
      const alice = await registerUser(aliceDto);
      const bob = await registerUser(bobDto);
      const trade = await createTrade(alice.token, bob.id);

      await request(app.getHttpServer())
        .patch(`${TRADES_URL}/${trade.id}/respond`)
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ accept: true })
        .expect(403);
    });

    it('returns 403 when trying to respond to an already-accepted trade', async () => {
      const alice = await registerUser(aliceDto);
      const bob = await registerUser(bobDto);
      const trade = await createTrade(alice.token, bob.id);

      await request(app.getHttpServer())
        .patch(`${TRADES_URL}/${trade.id}/respond`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ accept: true });

      await request(app.getHttpServer())
        .patch(`${TRADES_URL}/${trade.id}/respond`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ accept: false })
        .expect(403);
    });

    it('returns 404 for a non-existent trade id', async () => {
      const bob = await registerUser(bobDto);

      await request(app.getHttpServer())
        .patch(`${TRADES_URL}/00000000-0000-0000-0000-000000000000/respond`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ accept: true })
        .expect(404);
    });
  });

  // ─── PATCH /api/trades/:id/cancel ────────────────────────────

  describe('PATCH /api/trades/:id/cancel', () => {
    it('requester cancels their pending trade → status becomes CANCELLED', async () => {
      const alice = await registerUser(aliceDto);
      const bob = await registerUser(bobDto);
      const trade = await createTrade(alice.token, bob.id);

      const res = await request(app.getHttpServer())
        .patch(`${TRADES_URL}/${trade.id}/cancel`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      expect(res.body.status).toBe(TradeStatus.CANCELLED);
    });

    it('returns 403 when the receiver tries to cancel the trade', async () => {
      const alice = await registerUser(aliceDto);
      const bob = await registerUser(bobDto);
      const trade = await createTrade(alice.token, bob.id);

      await request(app.getHttpServer())
        .patch(`${TRADES_URL}/${trade.id}/cancel`)
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(403);
    });

    it('returns 403 when trying to cancel an already-accepted trade', async () => {
      const alice = await registerUser(aliceDto);
      const bob = await registerUser(bobDto);
      const trade = await createTrade(alice.token, bob.id);

      await request(app.getHttpServer())
        .patch(`${TRADES_URL}/${trade.id}/respond`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ accept: true });

      await request(app.getHttpServer())
        .patch(`${TRADES_URL}/${trade.id}/cancel`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(403);
    });

    it('returns 404 for a non-existent trade id', async () => {
      const alice = await registerUser(aliceDto);

      await request(app.getHttpServer())
        .patch(`${TRADES_URL}/00000000-0000-0000-0000-000000000000/cancel`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(404);
    });
  });

  // ─── GET /api/trades/activity ────────────────────────────────

  describe('GET /api/trades/activity', () => {
    it('returns recent trades ordered by updatedAt descending', async () => {
      const alice = await registerUser(aliceDto);
      const bob = await registerUser(bobDto);
      await createTrade(alice.token, bob.id);

      const res = await request(app.getHttpServer())
        .get(`${TRADES_URL}/activity`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe(TradeStatus.PENDING);
    });

    it('respects the limit query parameter', async () => {
      const alice = await registerUser(aliceDto);
      const bob = await registerUser(bobDto);

      await createTrade(alice.token, bob.id);
      await createTrade(bob.token, alice.id);

      const res = await request(app.getHttpServer())
        .get(`${TRADES_URL}/activity?limit=1`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
    });
  });
});
