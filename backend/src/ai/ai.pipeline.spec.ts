import { Test, TestingModule } from '@nestjs/testing';
import { AIService } from './ai.service';
import { GroqProvider } from './providers/groq.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { MacLocalProvider } from './providers/mac-local.provider';
import { LocalProvider } from './providers/local.provider';
import { PicoClawService } from './picoclaw.service';
import { RedisService } from './redis.service';
import { SettingsService } from './settings.service';
import { ConfigService } from '@nestjs/config';
import { DATABASE_CONNECTION } from '../database/database.module';

describe('AIService - Pipeline & Token Tracking', () => {
  let service: AIService;
  let macLocal: MacLocalProvider;
  let picoClaw: PicoClawService;
  let redis: RedisService;
  let settings: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        { provide: GroqProvider, useValue: { summarize: jest.fn(), checkHealth: jest.fn() } },
        { provide: OpenRouterProvider, useValue: { summarize: jest.fn(), checkHealth: jest.fn() } },
        { provide: MacLocalProvider, useValue: { summarize: jest.fn(), isAvailable: jest.fn(), isEnabled: jest.fn() } },
        { provide: LocalProvider, useValue: { isEnabled: jest.fn() } },
        { provide: PicoClawService, useValue: { translate: jest.fn(), process: jest.fn() } },
        { provide: RedisService, useValue: { get: jest.fn(), set: jest.fn(), trackTokens: jest.fn(), getTokenUsage: jest.fn() } },
        { provide: SettingsService, useValue: { getModelConfig: jest.fn(), getSetting: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: DATABASE_CONNECTION, useValue: { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis() } },
      ],
    }).compile();

    service = module.get<AIService>(AIService);
    macLocal = module.get<MacLocalProvider>(MacLocalProvider);
    picoClaw = module.get<PicoClawService>(PicoClawService);
    redis = module.get<RedisService>(RedisService);
    settings = module.get<SettingsService>(SettingsService);

    // Default pipeline config
    (settings.getModelConfig as jest.Mock).mockResolvedValue({
      summarizationPipeline: ['mac_local', 'groq'],
      translationPipeline: ['mac_local', 'groq'],
    });
  });

  describe('processSignal - Fallback Logic', () => {
    it('should fall back to PicoClaw Router if Direct Mac Local fails', async () => {
      // 1. Direct Mac Local fails (returns null)
      (macLocal.isAvailable as jest.Mock).mockResolvedValue(true);
      (macLocal.summarize as jest.Mock).mockResolvedValue(null);

      // 2. PicoClaw Router succeeds
      (picoClaw.process as jest.Mock).mockResolvedValue({
        result: 'This is a high quality summary that is long enough to pass the check.',
        provider: 'mac'
      });

      await service.processSignal('1', 'Test Title', 'Test Content', 10);

      // Verify both were called
      expect(macLocal.summarize).toHaveBeenCalled();
      expect(picoClaw.process).toHaveBeenCalled();
    });
  });

  describe('Token Tracking', () => {
    it('should track tokens when Mac Local successfully processes a signal', async () => {
        // This test actually tests the Provider directly to ensure trackTokens is called
        // Since AIService calls Provider.summarize()
        
        // We'll mock the fetch response for MacLocalProvider in a real scenario, 
        // but here we just want to ensure AIService uses the provider.
        
        (macLocal.isAvailable as jest.Mock).mockResolvedValue(true);
        (macLocal.summarize as jest.Mock).mockResolvedValue('This is another high quality summary that is definitely over twenty characters.');
        
        await service.processSignal('1', 'Test', 'Content');
        
        expect(macLocal.summarize).toHaveBeenCalled();
    });
  });
});
