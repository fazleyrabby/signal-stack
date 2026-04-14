import { Test, TestingModule } from '@nestjs/testing';
import { FeedService } from './feed.service';
import { ScorerService } from '../scorer/scorer.service';
import { DATABASE_CONNECTION } from '../database/database.module';
import Parser from 'rss-parser';

jest.mock('rss-parser');
jest.mock('p-limit', () => () => (fn: any) => fn());
jest.mock('striptags', () => (html: string) => html.replace(/<[^>]*>?/gm, ''));

describe('FeedService', () => {
  let service: FeedService;
  let scorerService: ScorerService;
  let db: any;
  let mockParser: any;

  beforeEach(async () => {
    mockParser = {
      parseString: jest.fn(),
    };
    (Parser as unknown as jest.Mock).mockImplementation(() => mockParser);

    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        {
          provide: ScorerService,
          useValue: { score: jest.fn() },
        },
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
      ],
    }).compile();

    service = module.get<FeedService>(FeedService);
    scorerService = module.get<ScorerService>(ScorerService);
    
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchAllFeeds', () => {
    it('should fetch and score items from active sources', async () => {
      const mockSources = [
        { id: '1', name: 'Source 1', url: 'http://src1.com', isActive: true, categoryId: 'cat1' },
      ];
      db.where.mockResolvedValue(mockSources);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('<rss></rss>'),
      });

      mockParser.parseString.mockResolvedValue({
        items: [
          { title: 'Title 1', link: 'http://link1.com', content: 'Content 1', pubDate: new Date().toUTCString() },
        ],
      });

      (scorerService.score as jest.Mock).mockResolvedValue({
          title: 'Title 1',
          score: 8
      });

      const results = await service.fetchAllFeeds();

      expect(results).toHaveLength(1);
      expect(results[0].score).toBe(8);
      expect(db.select).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith('http://src1.com', expect.any(Object));
    });

    it('should handle fetch errors gracefully', async () => {
      db.where.mockResolvedValue([{ id: '1', name: 'Fail', url: 'http://fail.com', isActive: true }]);
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const results = await service.fetchAllFeeds();

      expect(results).toHaveLength(0);
    });
  });

  describe('normalizeItem', () => {
    it('should strip HTML and decode entities', () => {
      const source: any = { name: 'Test', categoryId: 'cat' };
      const item: any = {
        title: 'Title &amp; Symbol',
        link: 'http://test.com',
        content: '<p>Some <b>HTML</b> content</p>',
        pubDate: new Date().toUTCString(),
      };

      const normalized = (service as any).normalizeItem(item, source);

      expect(normalized.title).toBe('Title & Symbol');
      expect(normalized.content).toBe('Some HTML content');
    });

    it('should return null for stale items', () => {
        const source: any = { name: 'Test' };
        const staleDate = new Date();
        staleDate.setDate(staleDate.getDate() - 10);
        
        const item: any = {
          title: 'Old',
          link: 'http://old.com',
          pubDate: staleDate.toUTCString(),
        };
  
        const normalized = (service as any).normalizeItem(item, source);
        expect(normalized).toBeNull();
      });
  });

  describe('checkSourceHealth', () => {
    it('should return healthy for valid RSS', async () => {
      db.limit.mockResolvedValue([{ id: '1', url: 'http://ok.com' }]);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('<item>Data</item>'),
        headers: { get: () => 'application/xml' }
      });

      const health = await service.checkSourceHealth('1');
      expect(health.status).toBe('healthy');
      expect(health.hasData).toBe(true);
    });
  });

  describe('toggleSource', () => {
      it('should toggle active status', async () => {
          db.limit.mockResolvedValue([{ id: '1', isActive: true }]);
          
          const result = await service.toggleSource('1');
          
          expect(result.success).toBe(true);
          expect(result.isActive).toBe(false);
          expect(db.update).toHaveBeenCalled();
      });
  });
});
