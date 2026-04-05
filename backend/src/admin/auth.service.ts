import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly accessTokenExpiry = '15m';
  private readonly refreshTokenExpiry = '7d';

  constructor(private configService: ConfigService) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || 'signalstack-jwt-secret-change-in-production';
  }

  async login(apiKey: string): Promise<{ accessToken: string; refreshToken: string }> {
    const validKey = this.configService.get<string>('ADMIN_API_KEY') || 'dev-admin-key';

    if (apiKey !== validKey) {
      throw new UnauthorizedException('Invalid Admin Key');
    }

    const accessToken = jwt.sign(
      { role: 'admin' },
      this.jwtSecret,
      { expiresIn: this.accessTokenExpiry }
    );

    const refreshToken = jwt.sign(
      { role: 'admin', type: 'refresh' },
      this.jwtSecret,
      { expiresIn: this.refreshTokenExpiry }
    );

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret) as { role: string; type: string };

      if (decoded.role !== 'admin' || decoded.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token');
      }

      return this.login(this.configService.get<string>('ADMIN_API_KEY') || 'dev-admin-key');
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  verifyAccessToken(token: string): { role: string } {
    try {
      return jwt.verify(token, this.jwtSecret) as { role: string };
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
