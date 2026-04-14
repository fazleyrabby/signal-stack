import { Test, TestingModule } from '@nestjs/testing';
import { OpenRouterProvider } from './openrouter.provider';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis.service';
import { SettingsService } from '../settings.service';

describe('OpenRouterProvider', () => {
  let provider: OpenRouterProvider;
  let redisService: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenRouterProvider,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('mock-key') },
        },
        {
          provide: RedisService,
          useValue: { trackTokens: jest.fn() },
        },
        {
          provide: SettingsService,
          useValue: { getModelConfig: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    provider = module.get<OpenRouterProvider>(OpenRouterProvider);
    redisService = module.get<RedisService>(RedisService);
    global.fetch = jest.fn();
  });

  describe('summarize', () => {
    it('should return summary on success', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'OpenRouter summary' } }],
          usage: { prompt_tokens: 20, completion_tokens: 10 },
        }),
      });

      const result = await provider.summarize('Title', 'Content');
      expect(result).toBe('OpenRouter summary');
      expect(redisService.trackTokens).toHaveBeenCalledWith('openrouter', 20, 10);
    });
  });

  describe('checkHealth', () => {
    it('should return healthy if API responds', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
      const health = await provider.checkHealth();
      expect(health.status).toBe('healthy');
    });
  });
});
