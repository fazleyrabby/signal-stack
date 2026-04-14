import { Test, TestingModule } from '@nestjs/testing';
import { SignalsService } from './signals.service';
import { SignalsRepository } from './signals.repository';
import { AIQueue } from '../ai/ai.queue';
import { ScoredSignal } from '../common/types';

describe('SignalsService', () => {
  let service: SignalsService;
  let repository: SignalsRepository;
  let aiQueue: AIQueue;

  const mockRepository = {
    hashExists: jest.fn(),
    insert: jest.fn(),
    findAll: jest.fn(),
    getStats: jest.fn(),
    getUniqueSources: jest.fn(),
    getAIProviderStats: jest.fn(),
    getTrends: jest.fn(),
    getGeoStats: jest.fn(),
  };

  const mockAIQueue = {
    enqueue: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignalsService,
        { provide: SignalsRepository, useValue: mockRepository },
        { provide: AIQueue, useValue: mockAIQueue },
      ],
    }).compile();

    service = module.get<SignalsService>(SignalsService);
    repository = module.get<SignalsRepository>(SignalsRepository);
    aiQueue = module.get<AIQueue>(AIQueue);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('insertSignal', () => {
    const mockSignal: ScoredSignal = {
      source: 'test-source',
      categoryId: 'test-cat',
      title: 'test-title',
      content: 'test-content',
      url: 'test-url',
      score: 8,
      severity: 'high',
      summary: 'test-summary',
      aiCategory: 'test-ai-cat',
      hash: 'test-hash',
      publishedAt: new Date(),
    };

    it('should return false if hash already exists', async () => {
      mockRepository.hashExists.mockResolvedValue(true);
      const result = await service.insertSignal(mockSignal);
      expect(result).toBe(false);
      expect(repository.insert).not.toHaveBeenCalled();
    });

    it('should insert and enqueue to AI queue if score >= 7', async () => {
      mockRepository.hashExists.mockResolvedValue(false);
      mockRepository.insert.mockResolvedValue({ id: '1', ...mockSignal });

      const result = await service.insertSignal(mockSignal);

      expect(result).toBe(true);
      expect(repository.insert).toHaveBeenCalled();
      expect(aiQueue.enqueue).toHaveBeenCalledWith({
        id: '1',
        title: mockSignal.title,
        content: mockSignal.content,
        score: mockSignal.score,
      });
    });

    it('should insert but NOT enqueue if score < 7', async () => {
      const lowScoreSignal = { ...mockSignal, score: 5 };
      mockRepository.hashExists.mockResolvedValue(false);
      mockRepository.insert.mockResolvedValue({ id: '2', ...lowScoreSignal });

      const result = await service.insertSignal(lowScoreSignal);

      expect(result).toBe(true);
      expect(aiQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should return false if insert fails (returns null)', async () => {
      mockRepository.hashExists.mockResolvedValue(false);
      mockRepository.insert.mockResolvedValue(null);

      const result = await service.insertSignal(mockSignal);

      expect(result).toBe(false);
      expect(aiQueue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('getSignals', () => {
    it('should call repository.findAll with default parameters', async () => {
      mockRepository.findAll.mockResolvedValue({ data: [], total: 0 });

      const result = await service.getSignals({ page: 1, limit: 20 });

      expect(repository.findAll).toHaveBeenCalledWith(expect.objectContaining({
        page: 1,
        limit: 20,
      }));
      expect(result.meta.totalPages).toBe(0);
    });

    it('should handle pagination and filtering', async () => {
      mockRepository.findAll.mockResolvedValue({ data: [], total: 50 });

      const result = await service.getSignals({
        page: 2,
        limit: 10,
        severity: 'high',
        since: '2023-01-01',
      });

      expect(repository.findAll).toHaveBeenCalledWith(expect.objectContaining({
        page: 2,
        limit: 10,
        severity: 'high',
        since: expect.any(Date),
      }));
      expect(result.meta.totalPages).toBe(5);
    });

    it('should enforce limits and defaults', async () => {
      mockRepository.findAll.mockResolvedValue({ data: [], total: 0 });

      await service.getSignals({ page: -1, limit: 1000 });

      expect(repository.findAll).toHaveBeenCalledWith(expect.objectContaining({
        page: 1,
        limit: 100,
      }));
    });
  });

  describe('Other methods', () => {
    it('getStats should call repository', async () => {
      mockRepository.getStats.mockResolvedValue({});
      await service.getStats();
      expect(repository.getStats).toHaveBeenCalled();
    });

    it('getUniqueSources should call repository', async () => {
      mockRepository.getUniqueSources.mockResolvedValue([]);
      await service.getUniqueSources('cat');
      expect(repository.getUniqueSources).toHaveBeenCalledWith('cat');
    });

    it('getAIProviderStats should call repository', async () => {
      mockRepository.getAIProviderStats.mockResolvedValue([]);
      await service.getAIProviderStats();
      expect(repository.getAIProviderStats).toHaveBeenCalled();
    });

    it('getTrends should call repository', async () => {
      mockRepository.getTrends.mockResolvedValue({});
      await service.getTrends();
      expect(repository.getTrends).toHaveBeenCalled();
    });

    it('getGeoStats should call repository', async () => {
      mockRepository.getGeoStats.mockResolvedValue([]);
      await service.getGeoStats();
      expect(repository.getGeoStats).toHaveBeenCalled();
    });
  });
});
