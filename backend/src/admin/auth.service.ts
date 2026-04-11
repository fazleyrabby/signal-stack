import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { users } from '../database/schema';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly accessTokenExpiry = '15m';
  private readonly refreshTokenExpiry = '7d';

  constructor(
    private configService: ConfigService,
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
  ) {
    this.jwtSecret =
      this.configService.get<string>('JWT_SECRET') ||
      'signalstack-jwt-secret-change-in-production';
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.accessTokenExpiry,
      algorithm: 'HS256',
    });

    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      this.jwtSecret,
      { expiresIn: this.refreshTokenExpiry, algorithm: 'HS256' },
    );

    return { accessToken, refreshToken };
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret, {
        algorithms: ['HS256'],
      }) as {
        sub: string;
        email: string;
        role: string;
        type: string;
      };

      if (decoded.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token');
      }

      // Verify user still exists
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, decoded.sub))
        .limit(1);

      if (!user) {
        throw new UnauthorizedException('User no longer exists');
      }

      const payload = { sub: user.id, email: user.email, role: user.role };

      const accessToken = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.accessTokenExpiry,
        algorithm: 'HS256',
      });

      const newRefreshToken = jwt.sign(
        { ...payload, type: 'refresh' },
        this.jwtSecret,
        { expiresIn: this.refreshTokenExpiry, algorithm: 'HS256' },
      );

      return { accessToken, refreshToken: newRefreshToken };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  verifyAccessToken(token: string): {
    sub: string;
    email: string;
    role: string;
  } {
    try {
      return jwt.verify(token, this.jwtSecret) as {
        sub: string;
        email: string;
        role: string;
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
