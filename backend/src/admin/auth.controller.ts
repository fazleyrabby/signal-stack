import {
  Controller,
  Post,
  Body,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('api/admin/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!email || !password) {
      throw new UnauthorizedException('Email and password are required');
    }

    const tokens = await this.authService.login(email, password);
    const domain =
      process.env.NODE_ENV === 'production' ? '.fazleyrabbi.xyz' : undefined;

    res.cookie('signalstack_access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
      domain,
    });

    res.cookie('signalstack_refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/admin/auth/refresh',
      domain,
    });

    return { success: true };
  }

  @Post('refresh')
  async refresh(
    @Body('refreshToken') refreshToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = refreshToken || res.req?.cookies?.signalstack_refresh_token;
    if (!token) {
      throw new UnauthorizedException('Refresh token required');
    }

    const tokens = await this.authService.refresh(token);
    const domain =
      process.env.NODE_ENV === 'production' ? '.fazleyrabbi.xyz' : undefined;

    res.cookie('signalstack_access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
      domain,
    });

    res.cookie('signalstack_refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/admin/auth/refresh',
      domain,
    });

    return { success: true };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    const domain =
      process.env.NODE_ENV === 'production' ? '.fazleyrabbi.xyz' : undefined;
    res.clearCookie('signalstack_access_token', { path: '/', domain });
    res.clearCookie('signalstack_refresh_token', {
      path: '/api/admin/auth/refresh',
      domain,
    });
    return { success: true };
  }
}
