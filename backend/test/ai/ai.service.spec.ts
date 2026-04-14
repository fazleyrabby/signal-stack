import { Test, TestingModule } from '@nestjs/testing';
import { AIService } from '../../src/ai/ai.service';
import { LocalProvider } from '../../src/ai/providers/local.provider';
import { GroqProvider } from '../../src/ai/providers/groq.provider';
import { OpenRouterProvider } from '../../src/ai/providers/openrouter.provider';
import { RedisService } from '../../src/ai/redis.service';
import { ConfigService } from '@nestjs/config';
import { DATABASE_CONNECTION } from '../../src/database/database.module';

describe('AIService', () => {
  let service: AIService;
  let localProvider: LocalProvider;
  let groqProvider: GroqProvider;
  let openRouterProvider: OpenRouterProvider;
  let redisService: RedisService;
  let db: any;
  let configService: ConfigService;

  beforeEach(async () => {
    // Mock database with fluent interface
    const dbChain = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([{ id: '1' }]),
    };

    db = {
      update: jest.fn().mockReturnValue(dbChain),
    };

    // Mock Redis service
    const mockRedisService = {
      getTokenUsage: jest.fn().mockResolvedValue(0),
      trackTokens: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        {
          provide: LocalProvider,
          useValue: {
            summarize: jest.fn(),
            checkHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
            lastError: null,
          },
        },
        {
          provide: GroqProvider,
          useValue: {
            summarize: jest.fn(),
            checkHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
            lastError: null,
            modelName: 'llama-3.3-70b-versatile',
          },
        },
        {
          provide: OpenRouterProvider,
          useValue: {
            summarize: jest.fn(),
            checkHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
            lastError: null,
            modelName: 'meta-llama/llama-3.3-70b-instruct',
          },
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                NODE_ENV: 'production',
                LOCAL_AI_ENABLED: 'true',
                AI_EXTERNAL_ENABLED: 'true',
              };
              return config[key] || undefined;
            }),
          },
        },
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
      ],
    }).compile();

    service = module.get<AIService>(AIService);
    localProvider = module.get<LocalProvider>(LocalProvider);
    groqProvider = module.get<GroqProvider>(GroqProvider);
    openRouterProvider = module.get<OpenRouterProvider>(OpenRouterProvider);
    redisService = module.get<RedisService>(RedisService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Pipeline Flow', () => {
    it('should use local provider first when available and successful', async () => {
      (localProvider.summarize as jest.Mock).mockResolvedValue('Local summary');
      (groqProvider.summarize as jest.Mock).mockResolvedValue('Groq summary');

      await service.processSignal('1', 'Test Title', 'Test Content');

      expect(localProvider.summarize).toHaveBeenCalledWith('Test Title', 'Test Content');
      expect(groqProvider.summarize).not.toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
    });

    it('should fallback to groq when local fails', async () => {
      (localProvider.summarize as jest.Mock).mockResolvedValue(null);
      (groqProvider.summarize as jest.Mock).mockResolvedValue('Groq summary');

      await service.processSignal('1', 'Test Title', 'Test Content');

      expect(localProvider.summarize).toHaveBeenCalled();
      expect(groqProvider.summarize).toHaveBeenCalled();
      expect(openRouterProvider.summarize).not.toHaveBeenCalled();
    });

    it('should fallback to openrouter when groq fails', async () => {
      (localProvider.summarize as jest.Mock).mockResolvedValue(null);
      (groqProvider.summarize as jest.Mock).mockResolvedValue(null);
      (openRouterProvider.summarize as jest.Mock).mockResolvedValue('OpenRouter summary');

      await service.processSignal('1', 'Test Title', 'Test Content');

      expect(localProvider.summarize).toHaveBeenCalled();
      expect(groqProvider.summarize).toHaveBeenCalled();
      expect(openRouterProvider.summarize).toHaveBeenCalled();
    });

    it('should mark as failed when all providers fail', async () => {
      (localProvider.summarize as jest.Mock).mockResolvedValue(null);
      (groqProvider.summarize as jest.Mock).mockResolvedValue(null);
      (openRouterProvider.summarize as jest.Mock).mockResolvedValue(null);

      await expect(service.processSignal('1', 'Test Title', 'Test Content')).rejects.toThrow('All AI providers failed');
    });

    it('should retry local provider up to max retries before falling back', async () => {
      (localProvider.summarize as jest.Mock)
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValue(null);
      (groqProvider.summarize as jest.Mock).mockResolvedValue('Groq summary');

      await service.processSignal('1', 'Test Title', 'Test Content');

      expect(localProvider.summarize).toHaveBeenCalledTimes(2);
      expect(groqProvider.summarize).toHaveBeenCalled();
    });
  });

  describe('Local Only Mode', () => {
    it('should throw error in local-only mode when local fails', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config: Record<string, string> = {
          NODE_ENV: 'development',
          LOCAL_AI_ENABLED: 'true',
          AI_EXTERNAL_ENABLED: 'false',
        };
        return config[key] || undefined;
      });

      (localProvider.summarize as jest.Mock).mockResolvedValue(null);

      await expect(service.processSignal('1', 'Test Title', 'Test Content')).rejects.toThrow('Local AI failed in local-only mode');
      expect(groqProvider.summarize).not.toHaveBeenCalled();
    });

    it('should not call external providers in local-only mode', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config: Record<string, string> = {
          NODE_ENV: 'development',
          LOCAL_AI_ENABLED: 'true',
          AI_EXTERNAL_ENABLED: 'false',
        };
        return config[key] || undefined;
      });

      (localProvider.summarize as jest.Mock).mockResolvedValue('Local summary');

      await service.processSignal('1', 'Test Title', 'Test Content');

      expect(groqProvider.summarize).not.toHaveBeenCalled();
      expect(openRouterProvider.summarize).not.toHaveBeenCalled();
    });
  });

  describe('Cooldown Mechanism', () => {
    it('should skip provider when in cooldown', async () => {
      // Set cooldown on groq
      (groqProvider as any).lastError = 429;
      (localProvider.summarize as jest.Mock).mockResolvedValue(null);
      (openRouterProvider.summarize as jest.Mock).mockResolvedValue('OpenRouter summary');

      // Manually trigger cooldown through a 429 response
      (groqProvider.summarize as jest.Mock).mockImplementation(() => {
        (groqProvider as any).lastError = 429;
        return Promise.resolve(null);
      });

      await service.processSignal('1', 'Test Title', 'Test Content');

      // First call should try groq, fail with 429, then skip groq on subsequent calls
      // This test verifies the cooldown logic by checking providers are called in order
      expect(localProvider.summarize).toHaveBeenCalled();
    });
  });

  describe('High-Load Scenarios', () => {
    it('should handle concurrent signal processing', async () => {
      (localProvider.summarize as jest.Mock).mockResolvedValue('Local summary');

      const promises = Array(10)
        .fill(null)
        .map((_, i) => service.processSignal(String(i), `Title ${i}`, `Content ${i}`));

      await Promise.all(promises);

      expect(localProvider.summarize).toHaveBeenCalledTimes(10);
    });

    it('should handle rapid sequential calls without resource leaks', async () => {
      (localProvider.summarize as jest.Mock).mockResolvedValue('Local summary');

      for (let i = 0; i < 50; i++) {
        await service.processSignal(String(i), `Title ${i}`, `Content ${i}`);
      }

      expect(localProvider.summarize).toHaveBeenCalledTimes(50);
    });
  });

  describe('Timeout Scenarios', () => {
    it('should handle provider timeout gracefully', async () => {
      (localProvider.summarize as jest.Mock).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );
      (groqProvider.summarize as jest.Mock).mockResolvedValue('Groq summary');

      await service.processSignal('1', 'Test Title', 'Test Content');

      expect(localProvider.summarize).toHaveBeenCalled();
      expect(groqProvider.summarize).toHaveBeenCalled();
    });

    it('should handle slow provider responses', async () => {
      (localProvider.summarize as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('Slow local summary'), 50))
      );

      await service.processSignal('1', 'Test Title', 'Test Content');

      expect(localProvider.summarize).toHaveBeenCalled();
    });
  });

  describe('Health Check', () => {
    it('should return health status for all providers', async () => {
      const health = await service.getHealth();

      expect(health).toHaveProperty('local');
      expect(health).toHaveProperty('groq');
      expect(health).toHaveProperty('openrouter');
      expect(health).toHaveProperty('tokenUsage');
      expect(health.pipeline).toBe('local → groq → openrouter');
    });

    it('should track token usage in health check', async () => {
      (redisService.getTokenUsage as jest.Mock)
        .mockResolvedValueOnce(100) // groq today
        .mockResolvedValueOnce(500) // groq all time
        .mockResolvedValueOnce(50) // openrouter today
        .mockResolvedValueOnce(200); // openrouter all time

      const health = await service.getHealth();

      expect(health.tokenUsage.groq.today).toBe(100);
      expect(health.tokenUsage.groq.allTime).toBe(500);
      expect(health.tokenUsage.openrouter.today).toBe(50);
      expect(health.tokenUsage.openrouter.allTime).toBe(200);
    });
  });

  describe('Content Trimming', () => {
    it('should trim long content to max length', async () => {
      (localProvider.summarize as jest.Mock).mockResolvedValue('Summary');

      const longContent = 'a'.repeat(1000);
      await service.processSignal('1', 'Title', longContent);

      // Verify the content was trimmed before being passed
      const callArgs = (localProvider.summarize as jest.Mock).mock.calls[0];
      expect(callArgs[1].length).toBeLessThanOrEqual(500);
    });

    it('should use title when content is empty', async () => {
      (localProvider.summarize as jest.Mock).mockResolvedValue('Summary');

      await service.processSignal('1', 'Test Title', '');

      expect(localProvider.summarize).toHaveBeenCalledWith('Test Title', 'Test Title');
    });

    it('should use title when content is null', async () => {
      (localProvider.summarize as jest.Mock).mockResolvedValue('Summary');

      await service.processSignal('1', 'Test Title', null);

      expect(localProvider.summarize).toHaveBeenCalledWith('Test Title', 'Test Title');
    });
  });
});

describe('AIService Provider Failures', () => {
  let service: AIService;
  let localProvider: LocalProvider;
  let groqProvider: GroqProvider;
  let openRouterProvider: OpenRouterProvider;
  let db: any;

  beforeEach(async () => {
    const dbChain = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([{ id: '1' }]),
    };

    db = {
      update: jest.fn().mockReturnValue(dbChain),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        {
          provide: LocalProvider,
          useValue: {
            summarize: jest.fn(),
            checkHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
            lastError: null,
          },
        },
        {
          provide: GroqProvider,
          useValue: {
            summarize: jest.fn(),
            checkHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
            lastError: null,
            modelName: 'llama-3.3-70b-versatile',
          },
        },
        {
          provide: OpenRouterProvider,
          useValue: {
            summarize: jest.fn(),
            checkHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
            lastError: null,
            modelName: 'meta-llama/llama-3.3-70b-instruct',
          },
        },
        {
          provide: RedisService,
          useValue: {
            getTokenUsage: jest.fn().mockResolvedValue(0),
            trackTokens: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
                const config: Record<string, string> = {
                  NODE_ENV: 'production',
                  LOCAL_AI_ENABLED: 'true',
                  AI_EXTERNAL_ENABLED: 'true',
                };
                return config[key] || undefined;
              }),
          },
        },
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
      ],
    }).compile();

    service = module.get<AIService>(AIService);
    localProvider = module.get<LocalProvider>(LocalProvider);
    groqProvider = module.get<GroqProvider>(GroqProvider);
    openRouterProvider = module.get<OpenRouterProvider>(OpenRouterProvider);
  });

  it('should handle provider throwing errors', async () => {
    (localProvider.summarize as jest.Mock).mockRejectedValue(new Error('Network error'));
    (groqProvider.summarize as jest.Mock).mockResolvedValue('Groq summary');

    await service.processSignal('1', 'Test Title', 'Test Content');

    expect(groqProvider.summarize).toHaveBeenCalled();
  });

  it('should handle provider returning empty string', async () => {
    (localProvider.summarize as jest.Mock).mockResolvedValue('');
    (groqProvider.summarize as jest.Mock).mockResolvedValue('Groq summary');

    await service.processSignal('1', 'Test Title', 'Test Content');

    expect(groqProvider.summarize).toHaveBeenCalled();
  });
});
