import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import Redis from 'ioredis';
import { createTestApp, clearAll } from '../test/app-factory';

describe('AuthController (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redis: Redis;

  const REGISTER_URL = '/api/auth/register';
  const LOGIN_URL = '/api/auth/login';
  const REFRESH_URL = '/api/auth/refresh';
  const LOGOUT_URL = '/api/auth/logout';
  const ME_URL = '/api/users/me';

  const alice = {
    email: 'alice@example.com',
    username: 'alice',
    password: 'Password123!',
  };

  beforeAll(async () => {
    ({ app, dataSource, redis } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await clearAll(dataSource, redis);
  });

  // ─── Registration ────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('creates a new user and returns an access + refresh token pair', async () => {
      const res = await request(app.getHttpServer())
        .post(REGISTER_URL)
        .send(alice)
        .expect(201);

      expect(res.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });
    });

    it('returns 409 when the email is already registered', async () => {
      await request(app.getHttpServer()).post(REGISTER_URL).send(alice);

      await request(app.getHttpServer())
        .post(REGISTER_URL)
        .send({ ...alice, username: 'alice2' })
        .expect(409);
    });

    it('returns 409 when the username is already taken', async () => {
      await request(app.getHttpServer()).post(REGISTER_URL).send(alice);

      await request(app.getHttpServer())
        .post(REGISTER_URL)
        .send({ ...alice, email: 'other@example.com' })
        .expect(409);
    });

    it('returns 400 when required fields are missing', async () => {
      await request(app.getHttpServer())
        .post(REGISTER_URL)
        .send({ email: 'incomplete@example.com' })
        .expect(400);
    });
  });

  // ─── Login ───────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post(REGISTER_URL).send(alice);
    });

    it('returns a token pair for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post(LOGIN_URL)
        .send({ email: alice.email, password: alice.password })
        .expect(200);

      expect(res.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });
    });

    it('returns 401 for an incorrect password', async () => {
      await request(app.getHttpServer())
        .post(LOGIN_URL)
        .send({ email: alice.email, password: 'wrong-password' })
        .expect(401);
    });

    it('returns 401 for an unknown email', async () => {
      await request(app.getHttpServer())
        .post(LOGIN_URL)
        .send({ email: 'nobody@example.com', password: alice.password })
        .expect(401);
    });
  });

  // ─── Refresh ─────────────────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    it('issues a new token pair using a valid refresh token', async () => {
      const { body: tokens } = await request(app.getHttpServer())
        .post(REGISTER_URL)
        .send(alice);

      const res = await request(app.getHttpServer())
        .post(REFRESH_URL)
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);

      expect(res.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });
    });

    it('returns 401 when no refresh token is provided', async () => {
      await request(app.getHttpServer())
        .post(REFRESH_URL)
        .send({})
        .expect(401);
    });
  });

  // ─── Logout ──────────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('invalidates the refresh token so subsequent refresh returns 403', async () => {
      const { body: tokens } = await request(app.getHttpServer())
        .post(REGISTER_URL)
        .send(alice);

      await request(app.getHttpServer())
        .post(LOGOUT_URL)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .post(REFRESH_URL)
        .send({ refreshToken: tokens.refreshToken })
        .expect(403);
    });

    it('returns 401 when called without an access token', async () => {
      await request(app.getHttpServer()).post(LOGOUT_URL).expect(401);
    });
  });

  // ─── JWT guard ───────────────────────────────────────────────

  describe('protected routes', () => {
    it('returns 401 when the Authorization header is missing', async () => {
      await request(app.getHttpServer()).get(ME_URL).expect(401);
    });

    it('returns the user profile when a valid access token is provided', async () => {
      const { body: tokens } = await request(app.getHttpServer())
        .post(REGISTER_URL)
        .send(alice);

      const res = await request(app.getHttpServer())
        .get(ME_URL)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        email: alice.email,
        username: alice.username,
      });
      expect(res.body).not.toHaveProperty('password');
    });
  });
});
