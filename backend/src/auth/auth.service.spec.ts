import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { User } from '../users/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, 'create' | 'findByEmail' | 'findOrFail'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  const mockUser: Partial<User> = {
    id: 'user-uuid',
    email: 'test@example.com',
    username: 'testuser',
    password: '$2b$12$hashedpassword',
  };

  beforeEach(async () => {
    redis = { get: jest.fn(), set: jest.fn().mockResolvedValue('OK'), del: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findByEmail: jest.fn(),
            findOrFail: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('mock-token') },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('test-secret'),
            get: jest.fn().mockReturnValue('15m'),
          },
        },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  describe('register', () => {
    it('creates a user and returns an access/refresh token pair', async () => {
      (usersService.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.register('test@example.com', 'testuser', 'password');

      expect(usersService.create).toHaveBeenCalledWith('test@example.com', 'testuser', 'password');
      expect(result).toEqual({ accessToken: 'mock-token', refreshToken: 'mock-token' });
    });

    it('stores the refresh token in Redis', async () => {
      (usersService.create as jest.Mock).mockResolvedValue(mockUser);

      await service.register('test@example.com', 'testuser', 'password');

      expect(redis.set).toHaveBeenCalledWith(
        `rt:${mockUser.id}`,
        'mock-token',
        'EX',
        expect.any(Number),
      );
    });
  });

  describe('login', () => {
    it('returns a token pair for valid credentials', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const result = await service.login('test@example.com', 'password');

      expect(result).toEqual({ accessToken: 'mock-token', refreshToken: 'mock-token' });
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(service.login('unknown@example.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when password is incorrect', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(service.login('test@example.com', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    it('issues a new token pair when the stored refresh token matches', async () => {
      redis.get.mockResolvedValue('valid-refresh-token');
      (usersService.findOrFail as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.refresh('user-uuid', 'valid-refresh-token');

      expect(result).toEqual({ accessToken: 'mock-token', refreshToken: 'mock-token' });
    });

    it('throws ForbiddenException when no token exists in Redis', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.refresh('user-uuid', 'any-token')).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when stored token does not match', async () => {
      redis.get.mockResolvedValue('stored-token');

      await expect(service.refresh('user-uuid', 'different-token')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('logout', () => {
    it('removes the refresh token from Redis', async () => {
      redis.del.mockResolvedValue(1);

      await service.logout('user-uuid');

      expect(redis.del).toHaveBeenCalledWith('rt:user-uuid');
    });
  });

  describe('issueTokens (via login)', () => {
    it('signs both access and refresh tokens with separate secrets', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await service.login('test@example.com', 'password');

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    });
  });
});
