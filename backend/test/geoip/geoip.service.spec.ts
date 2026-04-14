import { Test, TestingModule } from '@nestjs/testing';
import { GeoIPService } from '../../src/modules/geoip/geoip.service';
import * as maxmind from 'maxmind';
import * as fs from 'fs';

jest.mock('maxmind');
jest.mock('fs');

describe('GeoIPService', () => {
  let service: GeoIPService;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    // Mock successful MaxMind DB load
    (maxmind.open as jest.Mock).mockResolvedValue({
      get: jest.fn().mockImplementation((ip: string) => {
        if (ip === '8.8.8.8') {
          return {
            country: { names: { en: 'United States' } },
            city: { names: { en: 'Mountain View' } },
            location: { latitude: 37.386, longitude: -122.0838, time_zone: 'America/Los_Angeles' },
          };
        }
        if (ip === '2001:4860:4860::8888') {
          return {
            country: { names: { en: 'United States' } },
          };
        }
        return null; // invalid/unresolvable
      }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [GeoIPService],
    }).compile();

    service = module.get<GeoIPService>(GeoIPService);
    await service.onModuleInit();
  });

  it('should resolve valid IPv4 correctly', () => {
    const result = service.lookup('8.8.8.8');
    expect(result).toEqual({
      country: 'United States',
      city: 'Mountain View',
      latitude: 37.386,
      longitude: -122.0838,
      timezone: 'America/Los_Angeles',
    });
  });

  it('should resolve valid IPv6 correctly', () => {
    const result = service.lookup('2001:4860:4860::8888');
    expect(result).toBeDefined();
    expect(result?.country).toBe('United States');
  });

  it('should safely return null for internal IPs', () => {
    expect(service.lookup('127.0.0.1')).toBeNull();
    expect(service.lookup('::1')).toBeNull();
  });

  it('should safely return null for unresolvable IPs', () => {
    expect(service.lookup('1.2.3.4')).toBeNull();
    expect(service.lookup('')).toBeNull();
  });
});
