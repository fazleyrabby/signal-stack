import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { VisitorsModule } from '../../src/visitors/visitors.module';
import { GeoIPModule } from '../../src/modules/geoip/geoip.module';
import { DatabaseModule, DATABASE_CONNECTION } from '../../src/database/database.module';
import { ConfigModule } from '@nestjs/config';
import { randomUUID } from 'crypto';

describe('VisitorsController (e2e)', () => {
  let app: INestApplication;
  let db: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), DatabaseModule, GeoIPModule, VisitorsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    db = app.get(DATABASE_CONNECTION);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/visitors/track creates and tracks a new session accurately', async () => {
    const sessionId = randomUUID();
    
    // Initial request: track new session
    await request(app.getHttpServer())
      .post('/api/visitors/track')
      .send({ ip: '1.1.1.1', userAgent: 'E2E-Tester', sessionId })
      .expect(201);

    // Track again to test page view increment
    await request(app.getHttpServer())
      .post('/api/visitors/track')
      .send({ ip: '1.1.1.1', userAgent: 'E2E-Tester', sessionId })
      .expect(201);

    // Verify raw DB entry and ensure schema structure is maintained
    const visitorsRecord = await db.query.visitors.findFirst({
      where: (v: any, { eq }: any) => eq(v.sessionId, sessionId),
    });

    expect(visitorsRecord).toBeDefined();
    expect(visitorsRecord.pageViews).toBe(2);
    expect(visitorsRecord.isBot).toBe(false);
  });

  it('GET /api/visitors/stats returns valid response shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/visitors/stats')
      .expect(200);

    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('today');
    expect(response.body).toHaveProperty('realtime');
  });
});
