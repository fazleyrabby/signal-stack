import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

jest.mock('ioredis');

describe('RedisService', () => {
  let service: RedisService;
  let mockRedis: any;
  let configService: ConfigService;

  beforeEach(async () => {
    mockRedis = {
      on: jest.fn(),
      disconnect: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      exists: jest.fn(),
      set: jest.fn(),
      incrby: jest.fn(),
      get: jest.fn(),
      scan: jest.fn(),
      mget: jest.fn(),
      status: 'ready',
    };

    (Redis as unknown as jest.Mock).mockReturnValue(mockRedis);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'REDIS_HOST') return 'localhost';
              if (key === 'REDIS_PORT') return 6379;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    configService = module.get<ConfigService>(ConfigService);
    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize redis client', () => {
      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        host: 'localhost',
        port: 6379,
      }));
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });
  });

  describe('checkAndIncrementLimit', () => {
    it('should return true if under limit', async () => {
      mockRedis.incr.mockResolvedValue(5);
      const result = await service.checkAndIncrementLimit(10);
      expect(result).toBe(true);
      expect(mockRedis.incr).toHaveBeenCalled();
    });

    it('should return false if over limit', async () => {
      mockRedis.incr.mockResolvedValue(11);
      const result = await service.checkAndIncrementLimit(10);
      expect(result).toBe(false);
    });

    it('should set expiry on first request', async () => {
      mockRedis.incr.mockResolvedValue(1);
      await service.checkAndIncrementLimit(10);
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('should fallback to true if redis is not ready', async () => {
      mockRedis.status = 'connecting';
      const result = await service.checkAndIncrementLimit(10);
      expect(result).toBe(true);
    });
  });

  describe('isProcessed', () => {
    it('should return true if key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);
      const result = await service.isProcessed('sig123');
      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith('ai:processed:sig123');
    });

    it('should return false if key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);
      const result = await service.isProcessed('sig456');
      expect(result).toBe(false);
    });
  });

  describe('markProcessed', () => {
    it('should set processed key with expiry', async () => {
      await service.markProcessed('sig123');
      expect(mockRedis.set).toHaveBeenCalledWith('ai:processed:sig123', '1', 'EX', 604800);
    });
  });

  describe('trackTokens', () => {
    it('should increment prompt and completion tokens', async () => {
      await service.trackTokens('groq', 10, 20);
      expect(mockRedis.incrby).toHaveBeenCalledTimes(2);
      expect(mockRedis.expire).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTokenUsage', () => {
    it('should return today usage', async () => {
      mockRedis.get.mockResolvedValueOnce('100').mockResolvedValueOnce('200');
      const result = await service.getTokenUsage('groq', true);
      expect(result).toEqual({ prompt: 100, completion: 200, total: 300 });
    });

    it('should return all-time usage using scan', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['key1']]) // prompt scan
        .mockResolvedValueOnce(['0', ['key2']]); // completion scan
      mockRedis.mget
        .mockResolvedValueOnce(['500']) // prompt values
        .mockResolvedValueOnce(['1000']); // completion values

      const result = await service.getTokenUsage('groq', false);
      expect(result).toEqual({ prompt: 500, completion: 1000, total: 1500 });
      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
    });
  });
});
