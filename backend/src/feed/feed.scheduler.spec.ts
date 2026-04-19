import { Test, TestingModule } from '@nestjs/testing';

jest.mock('p-limit', () => () => (fn: any) => fn());
jest.mock('striptags', () => (html: string) => html.replace(/<[^>]*>?/gm, ''));

import { FeedScheduler } from './feed.scheduler';
import { FeedService } from './feed.service';
import { SignalsService } from '../signals/signals.service';
import { DiscordService } from '../alerts/discord.service';
import { RedisService } from '../ai/redis.service';
import { DATABASE_CONNECTION } from '../database/database.module';
import { eq } from 'drizzle-orm';

describe('FeedScheduler', () => {
  let scheduler: FeedScheduler;
  let db: any;
  let feedService: FeedService;
  let signalsService: SignalsService;
  let discordService: DiscordService;

  beforeEach(async () => {
    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedScheduler,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
        {
          provide: FeedService,
          useValue: { fetchAllFeeds: jest.fn() },
        },
        {
          provide: SignalsService,
          useValue: { insertSignal: jest.fn() },
        },
        {
          provide: DiscordService,
          useValue: { sendAlert: jest.fn() },
        },
        {
          provide: RedisService,
          useValue: { del: jest.fn() },
        },
      ],
    }).compile();

    scheduler = module.get<FeedScheduler>(FeedScheduler);
    feedService = module.get<FeedService>(FeedService);
    signalsService = module.get<SignalsService>(SignalsService);
    discordService = module.get<DiscordService>(DiscordService);
  });

  describe('handleFeedCycle - Job Leak Prevention', () => {
    it('should skip signals from sources marked as type "job"', async () => {
      const mockSources = [
        { name: 'Remote OK', type: 'job', isActive: true, categoryId: 'technology' },
      ];
      db.where.mockResolvedValue(mockSources);

      const mockSignals = [
        { 
          source: 'Remote OK', 
          title: 'Project Manager I', 
          score: 8, 
          categoryId: 'technology',
          content: 'Job description' 
        },
      ];
      (feedService.fetchAllFeeds as jest.Mock).mockResolvedValue(mockSignals);

      await scheduler.handleFeedCycle();

      // Should not even try to insert or alert
      expect(signalsService.insertSignal).not.toHaveBeenCalled();
      expect(discordService.sendAlert).not.toHaveBeenCalled();
    });

    it('should filter out job-related titles even from tech feeds', async () => {
      const mockSources = [
        { name: 'TechCrunch', type: 'signal', isActive: true, categoryId: 'technology' },
      ];
      db.where.mockResolvedValue(mockSources);

      const mockSignals = [
        { 
          source: 'TechCrunch', 
          title: 'Hiring: Senior Software Architect', 
          score: 10, 
          categoryId: 'technology',
          content: 'We are hiring...' 
        },
      ];
      (feedService.fetchAllFeeds as jest.Mock).mockResolvedValue(mockSignals);
      (signalsService.insertSignal as jest.Mock).mockResolvedValue(true);

      await scheduler.handleFeedCycle();

      // Should be inserted into DB but NOT alerted to Discord
      expect(signalsService.insertSignal).toHaveBeenCalled();
      expect(discordService.sendAlert).not.toHaveBeenCalled();
    });

    it('should alert for legitimate high-score tech signals', async () => {
      const mockSources = [
        { name: 'Ars Technica', type: 'signal', isActive: true, categoryId: 'technology' },
      ];
      db.where.mockResolvedValue(mockSources);

      const mockSignals = [
        { 
          source: 'Ars Technica', 
          title: 'Major Security Breach at Cloudflare', 
          score: 10, 
          categoryId: 'technology',
          content: 'Cloudflare reports unauthorized access...' 
        },
      ];
      (feedService.fetchAllFeeds as jest.Mock).mockResolvedValue(mockSignals);
      (signalsService.insertSignal as jest.Mock).mockResolvedValue(true);

      await scheduler.handleFeedCycle();

      expect(signalsService.insertSignal).toHaveBeenCalled();
      expect(discordService.sendAlert).toHaveBeenCalledWith(mockSignals[0]);
    });
  });
});
