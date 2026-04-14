import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { DATABASE_CONNECTION } from '../database/database.module';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';

jest.mock('jsonwebtoken');
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let db: any;

  beforeEach(async () => {
    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('secret') },
        },
        { provide: DATABASE_CONNECTION, useValue: db },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      const mockUser = { id: '1', email: 'test@test.com', passwordHash: 'hashed', role: 'admin' };
      db.limit.mockResolvedValue([mockUser]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('token');

      const result = await service.login('test@test.com', 'password');

      expect(result).toEqual({ accessToken: 'token', refreshToken: 'token' });
      expect(db.select).toHaveBeenCalled();
      expect(bcrypt.compare).toHaveBeenCalledWith('password', 'hashed');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      db.limit.mockResolvedValue([]);
      await expect(service.login('wrong@test.com', 'pwd')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password invalid', async () => {
      db.limit.mockResolvedValue([{ passwordHash: 'hashed' }]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login('test@test.com', 'wrong')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should return new tokens for valid refresh token', async () => {
      const payload = { sub: '1', email: 'a@b.com', role: 'admin', type: 'refresh' };
      (jwt.verify as jest.Mock).mockReturnValue(payload);
      db.limit.mockResolvedValue([{ id: '1', email: 'a@b.com', role: 'admin' }]);
      (jwt.sign as jest.Mock).mockReturnValue('new-token');

      const result = await service.refresh('old-refresh-token');

      expect(result.accessToken).toBe('new-token');
      expect(result.refreshToken).toBe('new-token');
    });

    it('should throw if token is not a refresh token', async () => {
        (jwt.verify as jest.Mock).mockReturnValue({ type: 'access' });
        await expect(service.refresh('token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyAccessToken', () => {
      it('should return payload if valid', () => {
          const payload = { sub: '1' };
          (jwt.verify as jest.Mock).mockReturnValue(payload);
          expect(service.verifyAccessToken('token')).toEqual(payload);
      });

      it('should throw if invalid', () => {
          (jwt.verify as jest.Mock).mockImplementation(() => { throw new Error(); });
          expect(() => service.verifyAccessToken('invalid')).toThrow(UnauthorizedException);
      });
  });
});
