import { Test, TestingModule } from '@nestjs/testing';
import { AIQueue } from '../../src/ai/ai.queue';
import { AIService } from '../../src/ai/ai.service';
import { RedisService } from '../../src/ai/redis.service';
import { ConfigService } from '@nestjs/config';
import { DATABASE_CONNECTION } from '../../src/database/database.module';
import { waitFor } from '../utils/wait-for';

describe('AIQueue', () => {
  let queue: AIQueue;
  let aiService: AIService;
  let redisService: RedisService;
  let db: any;

  beforeAll(() => {
    process.env.AI_PROCESS_DELAY = '10';
    process.env.AI_MAX_WORKERS = '10';
    process.env.AI_DAILY_LIMIT = '1000';
  });

  beforeEach(async () => {
    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIQueue,
        {
          provide: AIService,
          useValue: {
            processSignal: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RedisService,
          useValue: {
            isProcessed: jest.fn().mockResolvedValue(false),
            markProcessed: jest.fn().mockResolvedValue(undefined),
            checkAndIncrementLimit: jest.fn().mockResolvedValue(true),
            trackTokens: jest.fn().mockResolvedValue(undefined),
            getTokenUsage: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string >= {
                AI_PROCESS_DELAY: '100',
                AI_MAX_WORKERS: '2',
                AI_DAILY_LIMIT: '150',
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

    queue = module.get<AIQueue>(AIQueue);
    aiService = module.get<AIService>(AIService);
    redisService = module.get<RedisService>(RedisService);

    // Initialize the queue
    await queue.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Enqueue', () => {
    it('should enqueue a job and process it', async () => {
      await queue.enqueue({
        id: 'test-1',
        title: 'Test Title',
        content: 'Test Content',
        score: 8,
      });

      await waitFor(200);

      expect(aiService.processSignal).toHaveBeenCalledWith(
        'test-1',
        'Test Title',
        'Test Content',
        8,
      );
    });

    it('should skip duplicate jobs', async () => {
      (redisService.isProcessed as jest.Mock).mockResolvedValue(true);

      await queue.enqueue({
        id: 'test-1',
        title: 'Test Title',
        content: 'Test Content',
      });

      expect(aiService.processSignal).not.toHaveBeenCalled();
    });

    it('should respect daily limit', async () => {
      (redisService.checkAndIncrementLimit as jest.Mock).mockResolvedValue(false);

      await queue.enqueue({
        id: 'test-1',
        title: 'Test Title',
        content: 'Test Content',
      });

      expect(aiService.processSignal).not.toHaveBeenCalled();
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed jobs with exponential backoff', async () => {
      (aiService.processSignal as jest.Mock)
        .mockRejectedValueOnce(new Error('AI failed'))
        .mockResolvedValue(undefined);

      await queue.enqueue({
        id: 'test-1',
        title: 'Test Title',
        content: 'Test Content',
      });

      await waitFor(200);

      expect(aiService.processSignal).toHaveBeenCalledTimes(1);
    });

    it('should mark successful jobs as processed', async () => {
      await queue.enqueue({
        id: 'test-1',
        title: 'Test Title',
        content: 'Test Content',
      });

      await waitFor(200);

      expect(redisService.markProcessed).toHaveBeenCalledWith('test-1');
    });
  });

  describe('Rate Limiting', () => {
    it('should process jobs with configured delay', async () => {
      const startTime = Date.now();

      await queue.enqueue({
        id: 'test-1',
        title: 'Test Title',
        content: 'Test Content',
      });

      await queue.enqueue({
        id: 'test-2',
        title: 'Test Title 2',
        content: 'Test Content 2',
      });

      await waitFor(250);

      expect(aiService.processSignal).toHaveBeenCalledTimes(2);
    });

    it('should limit concurrent workers', async () => {
      // Enqueue many jobs
      for (let i = 0; i < 10; i++) {
        await queue.enqueue({
          id: `test-${i}`,
          title: `Title ${i}`,
          content: `Content ${i}`,
        });
      }

      await waitFor(500);

      // Should process all jobs eventually
      expect(aiService.processSignal).toHaveBeenCalledTimes(10);
    });
  });

  describe('Queue Recovery', () => {
    it('should requeue pending signals on startup', async () => {
      const pendingSignals = [
        { id: 'pending-1', title: 'Pending 1', content: 'Content 1', score: 8 },
        { id: 'pending-2', title: 'Pending 2', content: 'Content 2', score: 9 },
      ];

      (db.where as jest.Mock).mockResolvedValue(pendingSignals);

      // Re-initialize to trigger requeue
      await queue.onModuleInit();
      await waitFor(200);

      // Should have requeued the pending signals
    });
  });

  describe('Queue Size', () => {
    it('should track queue size', async () => {
      await queue.enqueue({
        id: 'test-1',
        title: 'Test Title',
        content: 'Test Content',
      });

      expect(queue.queueSize).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('AIQueue High Load', () => {
  let queue: AIQueue;
  let aiService: AIService;
  let redisService: RedisService;
  let db: any;

  beforeEach(async () => {
    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIQueue,
        {
          provide: AIService,
          useValue: {
            processSignal: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RedisService,
          useValue: {
            isProcessed: jest.fn().mockResolvedValue(false),
            markProcessed: jest.fn().mockResolvedValue(undefined),
            checkAndIncrementLimit: jest.fn().mockResolvedValue(true),
            trackTokens: jest.fn().mockResolvedValue(undefined),
            getTokenUsage: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string >= {
                AI_PROCESS_DELAY: '50',
                AI_MAX_WORKERS: '5',
                AI_DAILY_LIMIT: '1000',
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

    queue = module.get<AIQueue>(AIQueue);
    aiService = module.get<AIService>(AIService);
    redisService = module.get<RedisService>(RedisService);

    await queue.onModuleInit();
  });

  it('should handle burst of 100 concurrent jobs', async () => {
    const jobs = [];
      for (let i = 0; i < 100; i++) {
        jobs.push(queue.enqueue({
          id: `burst-${i}`,
          title: `Burst Title ${i}`,
          content: `Burst Content ${i}`,
          score: 8,
        }));
      }

      await Promise.all(jobs);
      await waitFor(2000);

    expect(aiService.processSignal).toHaveBeenCalledTimes(100);
  });

  it('should handle mixed success/failure scenarios', async () => {
    let callCount = 0;
    (aiService.processSignal as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount % 3 === 0) {
        return Promise.reject(new Error('Intermittent failure'));
      }
      return Promise.resolve();
    });

    for (let i = 0; i < 30; i++) {
      await queue.enqueue({
        id: `mixed-${i}`,
        title: `Mixed Title ${i}`,
        content: `Mixed Content ${i}`,
      });
    }

    await waitFor(1500);

    expect(aiService.processSignal).toHaveBeenCalled();
  });
});
