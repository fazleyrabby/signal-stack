import { Test, TestingModule } from '@nestjs/testing';
import { AIService } from './ai.service';
import { GroqProvider } from './providers/groq.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { DATABASE_CONNECTION } from '../database/database.module';

describe('AIService', () => {
  let service: AIService;
  let groq: GroqProvider;
  let openRouter: OpenRouterProvider;
  let db: any;

  beforeEach(async () => {
    db = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([{ id: '1' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        {
          provide: GroqProvider,
          useValue: { summarize: jest.fn() },
        },
        {
          provide: OpenRouterProvider,
          useValue: { summarize: jest.fn() },
        },
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
      ],
    }).compile();

    service = module.get<AIService>(AIService);
    groq = module.get<GroqProvider>(GroqProvider);
    openRouter = module.get<OpenRouterProvider>(OpenRouterProvider);
  });

  it('should fallback to OpenRouter if Groq fails', async () => {
    (groq.summarize as jest.Mock).mockResolvedValue(null);
    (openRouter.summarize as jest.Mock).mockResolvedValue('Fallback summary');

    await service.processSignal('1', 'Test Title', 'Test Content');

    expect(groq.summarize).toHaveBeenCalled();
    expect(openRouter.summarize).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({
      aiSummary: 'Fallback summary',
      aiProcessed: true,
    }));
  });

  it('should mark as failed if both providers fail', async () => {
    (groq.summarize as jest.Mock).mockResolvedValue(null);
    (openRouter.summarize as jest.Mock).mockResolvedValue(null);

    await service.processSignal('1', 'Test Title', 'Test Content');

    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({
      aiProcessed: false,
      aiFailed: true,
    }));
  });
});
