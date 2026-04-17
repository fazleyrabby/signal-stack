import { Test, TestingModule } from '@nestjs/testing';
import { DirectoryCrawlerService, CRAWLER_SOURCES } from './directory-crawler.service';

describe('DirectoryCrawlerService', () => {
  let service: DirectoryCrawlerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DirectoryCrawlerService],
    }).compile();

    service = module.get<DirectoryCrawlerService>(DirectoryCrawlerService);
  });

  // ─── BACCO extractor ──────────────────────────────────────────────────────

  describe('extractBaccoCompanies', () => {
    it('extracts company name and website from member block', () => {
      const html = `
        <div class="media mt-5 member-list-img">
          <h5 class="mt-0">Acme BPO Ltd</h5>
          <a href="https://www.acmebpo.com">www.acmebpo.com</a>
        </div>
      `;
      const result = (service as any).extractBaccoCompanies(html);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Acme BPO Ltd');
      expect(result[0].website).toBe('https://www.acmebpo.com');
      expect(result[0].source).toBe('bacco');
      expect(result[0].tags).toEqual(['BPO', 'outsourcing']);
    });

    it('fixes double-slash href bug (https:////www.)', () => {
      const html = `
        <div class="media mt-5 member-list-img">
          <h5 class="mt-0">Double Slash Corp</h5>
          <a href="https:////www.doubleslash.com">www.doubleslash.com</a>
        </div>
      `;
      const result = (service as any).extractBaccoCompanies(html);
      expect(result[0].website).toBe('https://www.doubleslash.com');
    });

    it('handles missing website gracefully', () => {
      const html = `
        <div class="media mt-5 member-list-img">
          <h5 class="mt-0">No Website Co</h5>
          <p>No link here</p>
        </div>
      `;
      const result = (service as any).extractBaccoCompanies(html);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('No Website Co');
      expect(result[0].website).toBeNull();
    });

    it('skips bacco.org.bd self-links as website', () => {
      const html = `
        <div class="media mt-5 member-list-img">
          <h5 class="mt-0">Self Link Corp</h5>
          <a href="https://bacco.org.bd/member/123">Profile</a>
        </div>
      `;
      const result = (service as any).extractBaccoCompanies(html);
      expect(result[0].website).toBeNull();
    });

    it('extracts multiple companies from same page', () => {
      const html = `
        <div class="media mt-5 member-list-img">
          <h5 class="mt-0">Alpha Corp</h5>
          <a href="https://www.alpha.com">alpha.com</a>
        </div>
        <div class="media mt-5 member-list-img">
          <h5 class="mt-0">Beta Ltd</h5>
          <a href="https://www.beta.com">beta.com</a>
        </div>
      `;
      const result = (service as any).extractBaccoCompanies(html);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alpha Corp');
      expect(result[1].name).toBe('Beta Ltd');
    });

    it('returns empty array when no member blocks found', () => {
      const html = '<div class="other-content">Nothing here</div>';
      const result = (service as any).extractBaccoCompanies(html);
      expect(result).toHaveLength(0);
    });

    it('sets country to Bangladesh', () => {
      const html = `
        <div class="media mt-5 member-list-img">
          <h5 class="mt-0">BD Company</h5>
        </div>
      `;
      const result = (service as any).extractBaccoCompanies(html);
      expect(result[0].country).toBe('Bangladesh');
    });
  });

  // ─── bdjobs extractor ─────────────────────────────────────────────────────

  describe('extractBdjobsCompanies', () => {
    it('extracts company name from Org-name div', () => {
      const html = `
        <div class="Org-name">
          <a class="sub_window_new_update" data-path='companyofferedjobs.asp?id=24362&alias=1&companyname=Acme+Ltd' href="javascript:void(0);">
            Acme Ltd
          </a>
        </div>
      `;
      const result = (service as any).extractBdjobsCompanies(html);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Acme Ltd');
      expect(result[0].source).toBe('bdjobs');
      expect(result[0].website).toBeNull();
    });

    it('decodes &amp; in company names', () => {
      const html = `
        <div class="Org-name">
          <a href="javascript:void(0);">
            Smith &amp; Sons Ltd
          </a>
        </div>
      `;
      const result = (service as any).extractBdjobsCompanies(html);
      expect(result[0].name).toBe('Smith & Sons Ltd');
    });

    it('trims whitespace from company names', () => {
      const html = `
        <div class="Org-name">
          <a href="javascript:void(0);">

            Whitespace Corp

          </a>
        </div>
      `;
      const result = (service as any).extractBdjobsCompanies(html);
      expect(result[0].name).toBe('Whitespace Corp');
    });

    it('extracts multiple companies', () => {
      const html = `
        <div class="Org-name"><a href="javascript:void(0);">Company One</a></div>
        <div class="Org-name"><a href="javascript:void(0);">Company Two</a></div>
        <div class="Org-name"><a href="javascript:void(0);">Company Three</a></div>
      `;
      const result = (service as any).extractBdjobsCompanies(html);
      expect(result).toHaveLength(3);
    });

    it('returns empty array when no Org-name divs found', () => {
      const html = '<div class="other">Nothing</div>';
      const result = (service as any).extractBdjobsCompanies(html);
      expect(result).toHaveLength(0);
    });
  });

  // ─── bdjobs bank filter ───────────────────────────────────────────────────

  describe('BDJOBS_EXCLUDE bank filter', () => {
    const excluded = [
      'Dutch-Bangla Bank Ltd',
      'Islami Bank Bangladesh',
      'BRAC Bank PLC',
      'City Bank Limited',
      'Mutual Trust Bank',
      'Trust Bank Ltd',
      'Southeast Banking Corp',
      'ABC Insurance Company',
      'Premier Leasing Ltd',
      'Prime Finance and Investment',
      'National Financial Services',
    ];

    const allowed = [
      'Brain Station 23',
      'DataSoft Systems Bangladesh',
      'Kaz Software',
      'Leads Corporation',
      'TechnoNext Software',
      'TechnoNext Software Ltd',
    ];

    it.each(excluded)('filters out: %s', (name) => {
      const html = `<div class="Org-name"><a href="javascript:void(0);">${name}</a></div>`;
      const result = (service as any).extractBdjobsCompanies(html);
      expect(result).toHaveLength(0);
    });

    it.each(allowed)('allows through: %s', (name) => {
      const html = `<div class="Org-name"><a href="javascript:void(0);">${name}</a></div>`;
      const result = (service as any).extractBdjobsCompanies(html);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe(name);
    });
  });

  // ─── BASIS JSON parsing ───────────────────────────────────────────────────

  describe('crawlBasis — JSON parsing', () => {
    it('correctly parses company_name from API response items', async () => {
      const mockJson = {
        data: [
          { company_name: 'Brain Station 23', membership_no: '01-01-001', membership_type: 'General' },
          { company_name: 'DataSoft Systems', membership_no: '01-01-002', membership_type: 'Associate' },
        ],
        meta: { last_page: 1, total: 2, per_page: 15 },
      };

      jest.spyOn(service as any, 'fetchJson').mockResolvedValueOnce(mockJson);

      const result = await (service as any).crawlBasis();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Brain Station 23');
      expect(result[1].name).toBe('DataSoft Systems');
      expect(result[0].source).toBe('basis');
      expect(result[0].tags).toEqual(['software', 'IT']);
      expect(result[0].city).toBe('Dhaka');
    });

    it('deduplicates companies with same name', async () => {
      const mockJson = {
        data: [
          { company_name: 'Duplicate Corp', membership_no: '01-01-001' },
          { company_name: 'Duplicate Corp', membership_no: '01-01-002' },
        ],
        meta: { last_page: 1, total: 2, per_page: 15 },
      };

      jest.spyOn(service as any, 'fetchJson').mockResolvedValueOnce(mockJson);

      const result = await (service as any).crawlBasis();
      expect(result).toHaveLength(1);
    });

    it('stops early when fetchJson returns null (network failure)', async () => {
      jest.spyOn(service as any, 'fetchJson').mockResolvedValueOnce(null);
      const result = await (service as any).crawlBasis();
      expect(result).toHaveLength(0);
    });

    it('stops when last_page reached', async () => {
      const mockJson = {
        data: [{ company_name: 'Only Company', membership_no: '01-01-001' }],
        meta: { last_page: 1, total: 1, per_page: 15 },
      };

      const fetchSpy = jest.spyOn(service as any, 'fetchJson').mockResolvedValue(mockJson);
      jest.spyOn(service as any, 'randomDelay').mockResolvedValue(undefined);

      await (service as any).crawlBasis();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── CRAWLER_SOURCES metadata ─────────────────────────────────────────────

  describe('CRAWLER_SOURCES', () => {
    it('exports basis, bacco, bdjobs keys', () => {
      expect(Object.keys(CRAWLER_SOURCES)).toEqual(['basis', 'bacco', 'bdjobs']);
    });

    it('each source has label, description, country, tags', () => {
      for (const key of Object.keys(CRAWLER_SOURCES) as Array<keyof typeof CRAWLER_SOURCES>) {
        expect(CRAWLER_SOURCES[key].label).toBeTruthy();
        expect(CRAWLER_SOURCES[key].description).toBeTruthy();
        expect(CRAWLER_SOURCES[key].country).toBe('Bangladesh');
        expect(Array.isArray(CRAWLER_SOURCES[key].tags)).toBe(true);
      }
    });
  });
});
