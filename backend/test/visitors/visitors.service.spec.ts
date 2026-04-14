import { Test, TestingModule } from '@nestjs/testing';
import { VisitorsService } from '../../src/visitors/visitors.service';
import { ConfigService } from '@nestjs/config';
import { GeoIPService } from '../../src/modules/geoip/geoip.service';
import { DATABASE_CONNECTION } from '../../src/database/database.module';

describe('VisitorsService', () => {
  let service: VisitorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitorsService,
        { provide: ConfigService, useValue: {} },
        { provide: GeoIPService, useValue: { lookup: jest.fn() } },
        { provide: DATABASE_CONNECTION, useValue: {} },
      ],
    }).compile();

    service = module.get<VisitorsService>(VisitorsService);
  });

  describe('Bot Detection', () => {
    it('should detect curls/bots from user agent', () => {
      expect(service['detectBot']('curl/7.68.0', 1)).toBe(true);
      expect(service['detectBot']('Googlebot/2.1', 1)).toBe(true);
      expect(service['detectBot']('Mozilla/5.0 Chrome/120', 1)).toBe(false);
    });

    it('should flag anomalies as bots based on high pageviews', () => {
      expect(service['detectBot']('Mozilla/5.0 Chrome/120', 101)).toBe(true);
      expect(service['detectBot']('Mozilla/5.0 Chrome/120', 50)).toBe(false);
    });
  });
});
