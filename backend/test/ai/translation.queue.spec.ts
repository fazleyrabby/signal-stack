import { Test, TestingModule } from '@nestjs/testing';
import { TranslationQueue } from '../../src/ai/translation.queue';
import { AIService } from '../../src/ai/ai.service';
import { RedisService } from '../../src/ai/redis.service';
import { DATABASE_CONNECTION } from '../../src/database/database.module';
import { waitFor } from '../utils/wait-for';

describe('TranslationQueue', () => {
  let queue: TranslationQueue;
  let aiService: AIService;
  let redisService: RedisService;
  let db: any;

  beforeEach(async () => {
    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([{ translations: {} }]),
      execute: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranslationQueue,
        {
          provide: AIService,
          useValue: {
            translate: jest.fn().mockResolvedValue({ title: 'Translated', aiSummary: 'Summary' }),
          },
        },
        {
          provide: RedisService,
          useValue: {
            setLock: jest.fn().mockResolvedValue(true),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
      ],
    }).compile();

    queue = module.get<TranslationQueue>(TranslationQueue);
    aiService = module.get<AIService>(AIService);
    redisService = module.get<RedisService>(RedisService);

    await queue.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Concurrency & Locking', () => {
    it('should only enqueue ONE job for multiple parallel requests of the same signal + lang', async () => {
      // Mock setLock to return true only once
      let lockAcquired = false;
      (redisService.setLock as jest.Mock).mockImplementation(() => {
        if (!lockAcquired) {
          lockAcquired = true;
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });

      const job = { id: 'sig-1', title: 'Title', summary: 'Summary', lang: 'es' };
      
      // 10 parallel requests
      await Promise.all(Array(10).fill(null).map(() => queue.enqueue(job)));

      expect(redisService.setLock).toHaveBeenCalledTimes(10);
      // But only one should have proceeded to queue$.next() which we check via aiService call later
      
      await waitFor(100);
      expect(aiService.translate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Worker Execution', () => {
    it('should save translation, clear lock, and invalidate cache', async () => {
      const job = { id: 'sig-1', title: 'Title', summary: 'Summary', lang: 'es' };
      
      await queue.enqueue(job);
      await waitFor(100);

      // 1. Translation saved to DB
      expect(db.execute).toHaveBeenCalled();
      
      // 2. Cache invalidated for both keys
      expect(redisService.del).toHaveBeenCalledWith('sig_cache:sig-1:es');
      expect(redisService.del).toHaveBeenCalledWith('signal:sig-1:es');
      
      // 3. Lock released (in finally block)
      expect(redisService.del).toHaveBeenCalledWith('lock:trans:sig-1:es');
    });
  });
});
