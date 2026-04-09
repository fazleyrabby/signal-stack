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

    const accessToken = request.cookies?.signalstack_access_token;

    if (!accessToken) {
      throw new UnauthorizedException('No access token provided');
    }

    try {
      const decoded = jwt.verify(accessToken, jwtSecret, { algorithms: ['HS256'] }) as { sub: string; email: string; role: string };
      if (decoded.role === 'admin') {
        request.user = decoded;
        return true;
      }
    } catch {
      // Token expired or invalid
    }

    throw new UnauthorizedException('Invalid or expired session');
  }
}
