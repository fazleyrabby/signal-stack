import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { SignalsModule } from '../../src/signals/signals.module';
import { DatabaseModule, DATABASE_CONNECTION } from '../../src/database/database.module';
import { ConfigModule } from '@nestjs/config';
import { randomUUID } from 'crypto';

describe('SignalsController (e2e)', () => {
  let app: INestApplication;
  let db: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), DatabaseModule, SignalsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    db = app.get(DATABASE_CONNECTION);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up signals table before each test
    await db.delete(db.schema.signals).execute();
  });

  describe('Signal Insertion & Duplicate Rejection', () => {
    it('should insert a valid signal and return it', async () => {
      const signalData = {
        source: 'TestSource',
        categoryId: 'geopolitics',
        title: 'Test Signal Title',
        content: 'Test content for the signal',
        url: 'https://example.com/test-signal',
        score: 7,
        severity: 'high',
        hash: 'test-hash-' + randomUUID(),
        publishedAt: new Date().toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post('/api/signals/ingest')
        .send(signalData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(signalData.title);
    });

    it('should reject duplicate hash signals', async () => {
      const duplicateHash = 'duplicate-test-hash-' + randomUUID();
      const signalData = {
        source: 'TestSource',
        categoryId: 'geopolitics',
        title: 'First Signal',
        content: 'Content',
        url: 'https://example.com/first',
        score: 5,
        severity: 'medium',
        hash: duplicateHash,
        publishedAt: new Date().toISOString(),
      };

      // First insert should succeed
      await request(app.getHttpServer())
        .post('/api/signals/ingest')
        .send(signalData)
        .expect(201);

      // Second insert with same hash should fail
      await request(app.getHttpServer())
        .post('/api/signals/ingest')
        .send({ ...signalData, url: 'https://example.com/second' })
        .expect(409);
    });

    it('should handle empty content (use title)', async () => {
      const signalData = {
        source: 'TestSource',
        categoryId: 'technology',
        title: 'Signal With Empty Content',
        content: '',
        url: 'https://example.com/empty-content',
        score: 5,
        severity: 'low',
        hash: 'empty-content-hash-' + randomUUID(),
      };

      const response = await request(app.getHttpServer())
        .post('/api/signals/ingest')
        .send(signalData)
        .expect(201);

      expect(response.body).toBeDefined();
    });

    it('should handle very long content (truncation)', async () => {
      const longContent = 'a'.repeat(5000);
      const signalData = {
        source: 'TestSource',
        categoryId: 'technology',
        title: 'Long Content Signal',
        content: longContent,
        url: 'https://example.com/long-content',
        score: 5,
        severity: 'low',
        hash: 'long-content-hash-' + randomUUID(),
      };

      const response = await request(app.getHttpServer())
        .post('/api/signals/ingest')
        .send(signalData)
        .expect(201);

      expect(response.body).toBeDefined();
    });

    it('should handle special characters in URLs', async () => {
      const signalData = {
        source: 'TestSource',
        categoryId: 'geopolitics',
        title: 'Special URL Signal',
        content: 'Content',
        url: 'https://example.com/path?param1=value1&param2=value2#anchor',
        score: 5,
        severity: 'medium',
        hash: 'special-url-hash-' + randomUUID(),
      };

      const response = await request(app.getHttpServer())
        .post('/api/signals/ingest')
        .send(signalData)
        .expect(201);

      expect(response.body.url).toBe(signalData.url);
    });
  });

  describe('Signal Filtering & Pagination', () => {
    beforeEach(async () => {
      // Insert multiple test signals
      const signals = [
        { source: 'SourceA', categoryId: 'geopolitics', severity: 'high', score: 8, hash: 'filter-test-1-' + randomUUID() },
        { source: 'SourceA', categoryId: 'geopolitics', severity: 'medium', score: 5, hash: 'filter-test-2-' + randomUUID() },
        { source: 'SourceB', categoryId: 'technology', severity: 'low', score: 3, hash: 'filter-test-3-' + randomUUID() },
        { source: 'SourceA', categoryId: 'geopolitics', severity: 'high', score: 9, hash: 'filter-test-4-' + randomUUID() },
      ];

      for (const s of signals) {
        await request(app.getHttpServer())
          .post('/api/signals/ingest')
          .send({
            ...s,
            title: `Test Signal ${s.hash}`,
            content: 'Test content',
            url: `https://example.com/${s.hash}`,
            publishedAt: new Date().toISOString(),
          });
      }
    });

    it('should filter signals by severity', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/signals?severity=high')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach((signal: any) => {
        expect(signal.severity).toBe('high');
      });
    });

    it('should filter signals by source', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/signals?source=SourceA')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach((signal: any) => {
        expect(signal.source).toBe('SourceA');
      });
    });

    it('should filter signals by category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/signals?categoryId=geopolitics')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach((signal: any) => {
        expect(signal.categoryId).toBe('geopolitics');
      });
    });

    it('should return paginated results with metadata', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/signals?page=1&limit=2')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toHaveProperty('page', 1);
      expect(response.body.meta).toHaveProperty('limit', 2);
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('totalPages');
    });

    it('should sort by score descending', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/signals?sort=score&order=desc')
        .expect(200);

      const scores = response.body.data.map((s: any) => s.score);
      expect(scores).toEqual(scores.sort((a: number, b: number) => b - a));
    });

    it('should filter by minimum score', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/signals?minScore=7')
        .expect(200);

      response.body.data.forEach((signal: any) => {
        expect(signal.score).toBeGreaterThanOrEqual(7);
      });
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      const signals = [
        { title: 'Nuclear Summit 2024', content: 'World leaders meet', hash: 'search-test-1-' + randomUUID() },
        { title: 'Tech Conference', content: 'AI developments announced', hash: 'search-test-2-' + randomUUID() },
        { title: 'Climate Change Report', content: 'New environmental data', hash: 'search-test-3-' + randomUUID() },
      ];

      for (const s of signals) {
        await request(app.getHttpServer())
          .post('/api/signals/ingest')
          .send({
            ...s,
            source: 'SearchSource',
            categoryId: 'geopolitics',
            content: s.content,
            url: `https://example.com/${s.hash}`,
            score: 5,
            severity: 'medium',
            publishedAt: new Date().toISOString(),
          });
      }
    });

    it('should search by title', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/signals?search=Nuclear')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].title).toContain('Nuclear');
    });

    it('should search by content', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/signals?search=environment')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return empty results for non-matching search', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/signals?search=NonExistentTerm12345')
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed date in since filter', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/signals?since=invalid-date')
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('should handle limit > 100 (cap at 100)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/signals?limit=500')
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(100);
    });

    it('should handle page < 1 (default to 1)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/signals?page=-1')
        .expect(200);

      expect(response.body.meta.page).toBe(1);
    });

    it('should return empty array when no signals exist', async () => {
      // Clean table first
      await db.delete(db.schema.signals).execute();

      const response = await request(app.getHttpServer())
        .get('/api/signals')
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });
  });

  describe('Stats & Analytics', () => {
    beforeEach(async () => {
      // Insert some test data
      const signals = [
        { severity: 'high', score: 9, categoryId: 'geopolitics', hash: 'stats-test-1-' + randomUUID() },
        { severity: 'high', score: 8, categoryId: 'geopolitics', hash: 'stats-test-2-' + randomUUID() },
        { severity: 'medium', score: 5, categoryId: 'technology', hash: 'stats-test-3-' + randomUUID() },
        { severity: 'low', score: 3, categoryId: 'technology', hash: 'stats-test-4-' + randomUUID() },
      ];

      for (const s of signals) {
        await request(app.getHttpServer())
          .post('/api/signals/ingest')
          .send({
            ...s,
            source: 'StatsSource',
            title: `Stats Signal ${s.hash}`,
            content: 'Content',
            url: `https://example.com/${s.hash}`,
            publishedAt: new Date().toISOString(),
          });
      }
    });

    it('should return correct stats', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/signals/stats')
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('high');
      expect(response.body).toHaveProperty('medium');
      expect(response.body).toHaveProperty('low');
    });

    it('should return unique sources', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/signals/sources')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return trends data', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/signals/trends')
        .expect(200);

      expect(response.body).toHaveProperty('volumeByDay');
      expect(response.body).toHaveProperty('topSources');
      expect(response.body).toHaveProperty('severityDistribution');
    });
  });
});