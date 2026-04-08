import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { REDIS_CLIENT } from '../redis/redis.module';

const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async register(
    email: string,
    username: string,
    password: string,
  ): Promise<TokenPair> {
    const user = await this.usersService.create(email, username, password);
    return this.issueTokens(user);
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user);
  }

  async refresh(userId: string, token: string): Promise<TokenPair> {
    const stored = await this.redis.get(`rt:${userId}`);
    if (!stored || stored !== token) {
      throw new ForbiddenException('Refresh token is invalid or expired');
    }
    const user = await this.usersService.findOrFail(userId);
    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.redis.del(`rt:${userId}`);
  }

  private async issueTokens(user: User): Promise<TokenPair> {
    const payload = { sub: user.id, email: user.email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    await this.redis.set(`rt:${user.id}`, refreshToken, 'EX', REFRESH_TTL_SECONDS);

    return { accessToken, refreshToken };
  }
}
