import { Test, TestingModule } from '@nestjs/testing';
import { LocalProvider } from './local.provider';
import { ConfigService } from '@nestjs/config';

describe('LocalProvider', () => {
  let provider: LocalProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalProvider,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key) => {
            if (key === 'LOCAL_AI_ENABLED') return 'true';
            if (key === 'LOCAL_AI_URL') return 'http://localhost:11434/api/generate';
            if (key === 'LOCAL_AI_MODEL') return 'qwen2.5:0.5b';
            return undefined;
          }) },
        },
      ],
    }).compile();

    provider = module.get<LocalProvider>(LocalProvider);
    global.fetch = jest.fn();
  });

  describe('summarize', () => {
    it('should return summary on success', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Local summary is long enough to pass.' } }]
        }),
      });

      const result = await provider.summarize('Title', 'Content');
      expect(result).toBe('Local summary is long enough to pass.');
    });

    it('should handle fetch error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Fail'));
      const result = await provider.summarize('Title', 'Content');
      expect(result).toBeNull();
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
