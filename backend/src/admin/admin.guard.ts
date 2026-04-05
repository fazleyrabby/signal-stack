import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = this.configService.get<string>('ADMIN_API_KEY') || 'dev-admin-key';
    const clientKey = request.headers['x-admin-key'];

    console.log(`🛡️ Admin Guard Check [${request.method} ${request.url}] - Received Header: [${clientKey ? 'PRESENT' : 'MISSING'}]`);

    if (clientKey === apiKey) {
      return true;
    }

    console.warn(`🚨 Admin Guard: INVALID KEY REJECTED. Method: ${request.method}, URL: ${request.url}`);
    throw new UnauthorizedException('Invalid Admin Key');
  }
}
