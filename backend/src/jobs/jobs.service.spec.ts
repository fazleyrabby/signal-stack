import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { JobsRepository } from './jobs.repository';
import { JobsFeedService } from './jobs-feed.service';
import { SettingsService } from '../ai/settings.service';
import { DiscordService } from '../alerts/discord.service';
import { JobPreferences, RawJob } from '../common/types';

const mockRepository = { hashExists: jest.fn(), insert: jest.fn(), getActiveSources: jest.fn(), cleanup: jest.fn() };
const mockFeedService = { fetchJobs: jest.fn() };
const mockSettingsService = { getSetting: jest.fn(), setSetting: jest.fn() };
const mockDiscordService = { sendJobAlert: jest.fn() };

function makeJob(overrides: Partial<RawJob> = {}): RawJob {
  return {
    source: 'TestSource',
    title: 'Software Engineer',
    company: 'Acme Corp',
    location: 'Remote',
    remote: true,
    jobType: 'full-time',
    salaryRange: null,
    experienceLevel: null,
    description: 'Build cool things remotely.',
    url: 'https://example.com/job/1',
    publishedAt: new Date(),
    tags: ['typescript', 'nodejs'],
    ...overrides,
  };
}

function makePrefs(overrides: Partial<JobPreferences> = {}): JobPreferences {
  return {
    keywords: [],
    locations: [],
    remote: null,
    excludeKeywords: [],
    experienceLevels: [],
    strictGlobalRemote: false,
    ...overrides,
  };
}

describe('JobsService', () => {
  let service: JobsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: JobsRepository,   useValue: mockRepository },
        { provide: JobsFeedService,  useValue: mockFeedService },
        { provide: SettingsService,  useValue: mockSettingsService },
        { provide: DiscordService,   useValue: mockDiscordService },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    jest.clearAllMocks();
  });

  // ─── isCountryLocked (via matchesPreferences with strictGlobalRemote) ──────

  describe('Strict Global Remote — country-lock detection', () => {
    const prefs = makePrefs({ strictGlobalRemote: true });

    it('filters job with "US Only" in title', () => {
      const job = makeJob({ title: 'Backend Engineer — US Only', remote: true });
      expect((service as any).matchesPreferences(job, prefs)).toBe(false);
    });

    it('filters job with "UK Only" in location', () => {
      const job = makeJob({ location: 'Remote (UK Only)', remote: true });
      expect((service as any).matchesPreferences(job, prefs)).toBe(false);
    });

    it('filters job with "EST timezone required" in description', () => {
      const job = makeJob({ description: 'Must work EST timezone required hours.', remote: true });
      expect((service as any).matchesPreferences(job, prefs)).toBe(false);
    });

    it('filters job with "PST timezone only" in description', () => {
      const job = makeJob({ description: 'Candidate must be available PST timezone only.', remote: true });
      expect((service as any).matchesPreferences(job, prefs)).toBe(false);
    });

    it('filters job with "authorized to work in the US" in description', () => {
      const job = makeJob({ description: 'Must be authorized to work in the US.', remote: true });
      expect((service as any).matchesPreferences(job, prefs)).toBe(false);
    });

    it('filters job with "based in Germany" in description', () => {
      const job = makeJob({ description: 'Candidate must be based in Germany.', remote: true });
      expect((service as any).matchesPreferences(job, prefs)).toBe(false);
    });

    it('filters job with "Canada Only" in title', () => {
      const job = makeJob({ title: 'Full Stack Developer — Canada Only', remote: true });
      expect((service as any).matchesPreferences(job, prefs)).toBe(false);
    });

    it('filters job with "EMEA only" in description', () => {
      const job = makeJob({ description: 'This role is open EMEA only.', remote: true });
      expect((service as any).matchesPreferences(job, prefs)).toBe(false);
    });

    it('allows genuinely global remote job', () => {
      const job = makeJob({ title: 'Remote React Developer', location: 'Worldwide', description: 'Work from anywhere.' });
      expect((service as any).matchesPreferences(job, prefs)).toBe(true);
    });

    it('allows remote job with no geo-restriction language', () => {
      const job = makeJob({ description: 'Async-first team. Flexible hours. Open to all time zones.' });
      expect((service as any).matchesPreferences(job, prefs)).toBe(true);
    });

    it('does NOT filter on-site (non-remote) jobs — only remote claims matter', () => {
      // strictGlobalRemote only applies when job.remote === true
      const job = makeJob({ title: 'Engineer US Only', remote: false });
      expect((service as any).matchesPreferences(job, prefs)).toBe(true);
    });
  });

  describe('Strict Global Remote — disabled', () => {
    it('passes country-locked job through when strictGlobalRemote is false', () => {
      const prefs = makePrefs({ strictGlobalRemote: false });
      const job = makeJob({ title: 'Engineer US Only', remote: true });
      expect((service as any).matchesPreferences(job, prefs)).toBe(true);
    });

    it('passes country-locked job through when strictGlobalRemote is undefined', () => {
      const prefs = makePrefs({ strictGlobalRemote: undefined });
      const job = makeJob({ title: 'Engineer US Only', remote: true });
      expect((service as any).matchesPreferences(job, prefs)).toBe(true);
    });
  });

  // ─── matchesPreferences — existing filters still work ─────────────────────

  describe('matchesPreferences — keyword filtering', () => {
    it('returns false when exclude keyword matches title', () => {
      const prefs = makePrefs({ excludeKeywords: ['senior'] });
      const job = makeJob({ title: 'Senior Backend Engineer' });
      expect((service as any).matchesPreferences(job, prefs)).toBe(false);
    });

    it('returns false when no target keyword matches', () => {
      const prefs = makePrefs({ keywords: ['python', 'django'] });
      const job = makeJob({ title: 'React Developer', description: 'Build UI.', tags: [] });
      expect((service as any).matchesPreferences(job, prefs)).toBe(false);
    });

    it('returns true when keyword matches tag', () => {
      const prefs = makePrefs({ keywords: ['typescript'] });
      const job = makeJob({ tags: ['typescript', 'node'] });
      expect((service as any).matchesPreferences(job, prefs)).toBe(true);
    });
  });

  describe('matchesPreferences — remote preference', () => {
    it('filters non-remote job when remote: true required', () => {
      const prefs = makePrefs({ remote: true });
      const job = makeJob({ remote: false });
      expect((service as any).matchesPreferences(job, prefs)).toBe(false);
    });

    it('filters remote job when on-site only required', () => {
      const prefs = makePrefs({ remote: false });
      const job = makeJob({ remote: true });
      expect((service as any).matchesPreferences(job, prefs)).toBe(false);
    });

    it('allows any job when remote: null (all)', () => {
      const prefs = makePrefs({ remote: null });
      const remoteJob = makeJob({ remote: true });
      const onsiteJob = makeJob({ remote: false });
      expect((service as any).matchesPreferences(remoteJob, prefs)).toBe(true);
      expect((service as any).matchesPreferences(onsiteJob, prefs)).toBe(true);
    });
  });

  // ─── getPreferences ────────────────────────────────────────────────────────

  describe('getPreferences', () => {
    it('returns defaults when no setting stored', async () => {
      mockSettingsService.getSetting.mockResolvedValue(null);
      const prefs = await service.getPreferences();
      expect(prefs.keywords).toEqual([]);
      expect(prefs.remote).toBeNull();
      expect(prefs.strictGlobalRemote).toBeUndefined();
    });

    it('parses stored JSON including strictGlobalRemote', async () => {
      const stored = JSON.stringify({ keywords: ['php'], locations: [], remote: true, excludeKeywords: [], experienceLevels: [], strictGlobalRemote: true });
      mockSettingsService.getSetting.mockResolvedValue(stored);
      const prefs = await service.getPreferences();
      expect(prefs.keywords).toEqual(['php']);
      expect(prefs.strictGlobalRemote).toBe(true);
    });
  });
});
