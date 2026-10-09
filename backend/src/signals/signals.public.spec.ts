import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SignalsController } from './signals.controller';
import { SignalsService } from './signals.service';
import { SignalsRepository } from './signals.repository';
import { FeedService } from '../feed/feed.service';
import { AIQueue } from '../ai/ai.queue';
import { AIService } from '../ai/ai.service';
import { TranslationQueue } from '../ai/translation.queue';
import { MetricsService } from '../ai/metrics.service';
import { SettingsService } from '../ai/settings.service';
import { TRANSLATION_VERSION } from '../ai/translation.constants';

jest.mock('p-limit', () => ({ __esModule: true, default: jest.fn() }));

const id = 'c4fa4593-83c6-4eb1-8c68-44b7ce1a1d93';
const signal = {
  id,
  title: 'A new research release',
  aiSummary:
    'Researchers released a new model with documented evaluation results.',
  score: 7,
  translations: {
    bn: {
      v: TRANSLATION_VERSION,
      title: 'নতুন গবেষণা',
      aiSummary: 'গবেষকেরা মূল্যায়নের ফলসহ নতুন মডেল প্রকাশ করেছেন।',
    },
  },
};
describe('Public story endpoint', () => {
  let app: INestApplication;
  const repository = {
    findById: jest.fn(),
    getStats: jest.fn().mockResolvedValue({ total: 12 }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SignalsController],
      providers: [
        SignalsService,
        { provide: SignalsRepository, useValue: repository },
        { provide: FeedService, useValue: {} },
        { provide: AIQueue, useValue: {} },
        { provide: AIService, useValue: {} },
        { provide: TranslationQueue, useValue: {} },
        { provide: MetricsService, useValue: { recordCacheHit: jest.fn() } },
        { provide: SettingsService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    repository.findById.mockReset();
    repository.findById.mockResolvedValue(signal);
  });
  it('serves a story directly by its stable UUID', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/signals/${id}`)
      .expect(200);
    expect(res.body.id).toBe(id);
    expect(res.body.title).toBe(signal.title);
  });
  it('uses an available Bengali translation for a direct story link', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/signals/${id}?lang=bn`)
      .expect(200);
    expect(res.body.title).toBe(signal.translations.bn.title);
  });
  it('rejects malformed IDs before querying the database', async () => {
    await request(app.getHttpServer())
      .get('/api/signals/not-an-id')
      .expect(400);
    expect(repository.findById).not.toHaveBeenCalled();
  });
  it('returns 404 for expired or unknown stories', async () => {
    repository.findById.mockResolvedValue(null);
    await request(app.getHttpServer()).get(`/api/signals/${id}`).expect(404);
  });
  it('keeps static public API routes accessible', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/signals/stats')
      .expect(200);
    expect(res.body.total).toBe(12);
  });
  it('falls back to English for an unsupported locale', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/signals/${id}?lang=unknown`)
      .expect(200);
    expect(res.body.title).toBe(signal.title);
  });
});
