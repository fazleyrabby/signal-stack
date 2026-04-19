import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesService } from './companies.service';
import { RedisService } from '../ai/redis.service';
import { SettingsService } from '../ai/settings.service';
import { CompaniesRepository } from './companies.repository';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let mockRedis: any;
  let mockSettings: any;
  let mockCompaniesRepository: any;

  beforeEach(async () => {
    mockRedis = { get: jest.fn(), set: jest.fn() };
    mockSettings = { getSetting: jest.fn() };
    mockCompaniesRepository = {
      findByPlaceId: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: RedisService, useValue: mockRedis },
        { provide: SettingsService, useValue: mockSettings },
        { provide: CompaniesRepository, useValue: mockCompaniesRepository },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  describe('findNearbyMapbox', () => {
    it('should construct category URLs correctly with bbox fallback pattern', async () => {
      mockSettings.getSetting.mockResolvedValue('test-token');

      // Return empty results to trigger fallback per category
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ features: [] }),
      } as any);

      await (service as any).findNearbyMapbox(22.3569, 91.8129, 5000);

      const urls = fetchSpy.mock.calls.map((c: any[]) => c[0]);
      
      // Should make category requests (with bbox fallback pattern)
      const officeUrls = urls.filter((u: string) => u.includes('/category/office?'));
      const telecomUrls = urls.filter((u: string) => u.includes('/category/telecommunications?'));
      
      // Each category should be called at least once with bbox
      expect(officeUrls.some((u: string) => u.includes('bbox='))).toBe(true);
      expect(telecomUrls.some((u: string) => u.includes('bbox='))).toBe(true);

      fetchSpy.mockRestore();
    });

    it('should deduplicate results across categories', async () => {
      mockSettings.getSetting.mockResolvedValue('test-token');

      const mockFeature = {
        properties: {
          mapbox_id: 'duplicate-id',
          name: 'Test Company',
          categories: ['office'],
        },
        geometry: {
          coordinates: [91.8129, 22.3569],
        },
      };

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ features: [mockFeature] }),
      } as any);

      const result = await (service as any).findNearbyMapbox(22.3569, 91.8129, 5000);

      expect(result).toHaveLength(1);
      expect(result[0].placeId).toBe('duplicate-id');

      fetchSpy.mockRestore();
    });

    it('should apply haversine distance filter', async () => {
      mockSettings.getSetting.mockResolvedValue('test-token');

      const mockFeatures = [
        {
          properties: { mapbox_id: 'close', name: 'Close Company' },
          geometry: { coordinates: [91.8129, 22.3569] },
        },
        {
          properties: { mapbox_id: 'far', name: 'Far Company' },
          geometry: { coordinates: [92.0, 23.0] },
        },
      ];

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ features: mockFeatures }),
      } as any);

      const result = await (service as any).findNearbyMapbox(22.3569, 91.8129, 5000);

      expect(result).toHaveLength(1);
      expect(result[0].placeId).toBe('close');

      fetchSpy.mockRestore();
    });

    it('should return empty array if API key not configured', async () => {
      mockSettings.getSetting.mockResolvedValue(null);

      const result = await (service as any).findNearbyMapbox(22.3569, 91.8129, 5000);

      expect(result).toEqual([]);
    });

    it('should exclude non-tech companies', async () => {
      mockSettings.getSetting.mockResolvedValue('test-token');

      const mockFeatures = [
        {
          properties: { mapbox_id: 'tech', name: 'Tech Solutions Inc' },
          geometry: { coordinates: [91.8129, 22.3569] },
        },
        {
          properties: { mapbox_id: 'bank', name: 'Chase Bank' },
          geometry: { coordinates: [91.813, 22.357] },
        },
      ];

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ features: mockFeatures }),
      } as any);

      const result = await (service as any).findNearbyMapbox(22.3569, 91.8129, 5000);

      expect(result).toHaveLength(1);
      expect(result[0].placeId).toBe('tech');

      fetchSpy.mockRestore();
    });
  });
});
