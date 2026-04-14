import { Test, TestingModule } from '@nestjs/testing';
import { GroqProvider } from './groq.provider';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis.service';
import { SettingsService } from '../settings.service';

describe('GroqProvider', () => {
  let provider: GroqProvider;
  let configService: ConfigService;
  let redisService: RedisService;
  let settingsService: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroqProvider,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('mock-api-key') },
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

    provider = module.get<GroqProvider>(GroqProvider);
    configService = module.get<ConfigService>(ConfigService);
    redisService = module.get<RedisService>(RedisService);
    settingsService = module.get<SettingsService>(SettingsService);

    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('summarize', () => {
    it('should return a summary on success', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'This is a summary.' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      });

      const result = await provider.summarize('Title', 'Content');

      expect(result).toBe('This is a summary.');
      expect(redisService.trackTokens).toHaveBeenCalledWith('groq', 10, 5);
    });

    it('should return null if API key is missing', async () => {
      (provider as any).apiKey = undefined;
      const result = await provider.summarize('Title', 'Content');
      expect(result).toBeNull();
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
      });

      const result = await provider.summarize('Title', 'Content');

      expect(result).toBeNull();
      expect(provider.lastError).toBe(429);
    });

    it('should handle timeout/abort error', async () => {
        const error = new Error('Abort');
        error.name = 'AbortError';
        (global.fetch as jest.Mock).mockRejectedValue(error);
  
        const result = await provider.summarize('Title', 'Content');
  
        expect(result).toBeNull();
        expect(provider.lastError).toBe(408);
      });
  });

  describe('cleanResponse', () => {
    it('should clean and trim response', () => {
      const input = '  This is a \n multi-line  response.  ';
      const output = (provider as any).cleanResponse(input);
      expect(output).toBe('This is a multi-line response.');
    });

    it('should return empty string for boilerplate/garbage', () => {
        expect((provider as any).cleanResponse('I am an AI...')).toBe('');
        expect((provider as any).cleanResponse('no content provided')).toBe('');
        expect((provider as any).cleanResponse('abc')).toBe('');
      });
  });

  describe('checkHealth', () => {
      it('should return healthy if API responds ok', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
        const health = await provider.checkHealth();
        expect(health.status).toBe('healthy');
      });

      it('should return unhealthy if API fails', async () => {
        (global.fetch as jest.Mock).mockRejectedValue(new Error('Fail'));
        const health = await provider.checkHealth();
        expect(health.status).toBe('unhealthy');
      });
  });
});
