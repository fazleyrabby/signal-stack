import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const jwtSecret = this.configService.get<string>('JWT_SECRET') || 'signalstack-jwt-secret-change-in-production';

    // Try access token from cookie first
    const accessToken = request.cookies?.signalstack_access_token;

    if (accessToken) {
      try {
        const decoded = jwt.verify(accessToken, jwtSecret) as { role: string };
        if (decoded.role === 'admin') {
          return true;
        }
      } catch {
        // Token expired or invalid — continue to check header fallback
      }
    }

    // Fallback: allow x-admin-key header for API clients/scripts
    const apiKey = this.configService.get<string>('ADMIN_API_KEY') || 'dev-admin-key';
    const clientKey = request.headers['x-admin-key'];

    if (clientKey === apiKey) {
      return true;
    }

    throw new UnauthorizedException('Invalid or expired session');
  }
}
