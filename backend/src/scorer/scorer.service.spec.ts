import { Test, TestingModule } from '@nestjs/testing';
import { ScorerService } from './scorer.service';
import { RawSignal } from '../common/types';

describe('ScorerService', () => {
  let service: ScorerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScorerService],
    }).compile();

    service = module.get<ScorerService>(ScorerService);
  });

  describe('score', () => {
    const mockSource: any = {
      name: 'Test Source',
      trustScore: 2,
      categoryId: 'tech',
    };

    const mockRaw: RawSignal = {
      source: 'Test Source',
      categoryId: 'tech',
      title: 'Normal news',
      content: 'Just some content',
      url: 'http://test.com/1',
      publishedAt: new Date(),
    };

    it('should calculate base score from trust score', async () => {
      const result = await service.score(mockRaw, mockSource);
      expect(result.score).toBe(2);
      expect(result.severity).toBe('low');
    });

    it('should add points for high-priority keywords', async () => {
      const highSignal = { ...mockRaw, title: 'Critical outage detected' };
      const result = await service.score(highSignal, mockSource);
      
      // 2 (trust) + 5 (outage) = 7
      expect(result.score).toBe(7);
      expect(result.severity).toBe('medium');
    });

    it('should add points for entities', async () => {
      const entitySignal = { ...mockRaw, title: 'Google launches new feature' };
      const result = await service.score(entitySignal, mockSource);
      
      // 2 (trust) + 3 (Google) + 2 (launch) = 7
      expect(result.score).toBe(7);
    });

    it('should handle multiple keywords and entities', async () => {
      const complexSignal = { 
        ...mockRaw, 
        title: 'Microsoft cyberattack and breach',
        content: 'OpenAI mentioned as well'
      };
      const result = await service.score(complexSignal, mockSource);
      
      // 2 (trust) 
      // + 3 (Microsoft) 
      // + 5 (cyberattack) 
      // + 5 (attack) - subset of cyberattack
      // + 5 (breach) 
      // + 3 (OpenAI)
      // = 23
      expect(result.score).toBe(23);
      expect(result.severity).toBe('high');
    });

    it('should generate a unique hash', async () => {
        const result1 = await service.score(mockRaw, mockSource);
        const result2 = await service.score({ ...mockRaw, title: 'Other' }, mockSource);
        
        expect(result1.hash).toBeDefined();
        expect(result2.hash).toBeDefined();
        expect(result1.hash).not.toEqual(result2.hash);
    });

    it('should be case-insensitive for keywords', async () => {
        const result = await service.score({ ...mockRaw, title: 'OUTAGE' }, mockSource);
        expect(result.score).toBe(7);
    });
  });
});
