import { Injectable, Logger } from '@nestjs/common';
import { JobsRepository } from './jobs.repository';
import { JobsFeedService } from './jobs-feed.service';
import { SettingsService } from '../ai/settings.service';
import { DiscordService } from '../alerts/discord.service';
import { JobPreferences, RawJob } from '../common/types';
import { generateHash, generateContentHash } from '../common/hash.util';
import { logEvent } from '../common/logger';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly repository: JobsRepository,
    private readonly feedService: JobsFeedService,
    private readonly settingsService: SettingsService,
    private readonly discordService: DiscordService,
  ) {}

  async getPreferences(): Promise<JobPreferences> {
    const prefs = await this.settingsService.getSetting('job_preferences');
    if (!prefs) {
      return {
        keywords: [],
        locations: [],
        remote: null,
        excludeKeywords: [],
        experienceLevels: [],
      };
    }
    return JSON.parse(prefs);
  }

  async savePreferences(prefs: JobPreferences): Promise<void> {
    await this.settingsService.setSetting('job_preferences', JSON.stringify(prefs));
  }

  /**
   * Orchestrate job fetching and matching
   */
  async processJobs() {
    logEvent('info', 'jobs_process_start', {});
    
    const activeSources = await this.repository.getActiveSources();
    if (activeSources.length === 0) {
      logEvent('info', 'jobs_process_skip', { reason: 'no_active_sources' });
      return;
    }

    const rawJobs = await this.feedService.fetchJobs(activeSources);
    const prefs = await this.getPreferences();
    
    let newJobsCount = 0;
    let matchesCount = 0;

    let crossSourceDupes = 0;
    for (const raw of rawJobs) {
      const hash = generateHash(raw.title, raw.url);
      const contentHash = raw.company ? generateContentHash(raw.title, raw.company) : undefined;

      if (await this.repository.hashExists(hash)) continue;
      if (contentHash && await this.repository.contentHashExists(contentHash)) {
        crossSourceDupes++;
        continue;
      }

      const inserted = await this.repository.insert({
        ...raw,
        hash,
        contentHash,
      });

      if (inserted) {
        newJobsCount++;
        if (this.matchesPreferences(raw, prefs)) {
          matchesCount++;
          await this.notifyMatch(inserted);
        }
      }
    }

    logEvent('info', 'jobs_process_complete', {
      totalFetched: rawJobs.length,
      newJobs: newJobsCount,
      matches: matchesCount,
      crossSourceDupes,
    });
  }

  /**
   * Detect if a "remote" job is actually country/region locked.
   * Returns true if job should be filtered out due to geo-restriction.
   */
  private isCountryLocked(job: RawJob): boolean {
    const haystack = [job.title, job.location, job.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    // Country/region-specific restrictions
    const geoLockPatterns = [
      // US-specific
      /\bus[\s-]?only\b/, /\bunited states only\b/, /\busa only\b/,
      /\bmust be (based|located|residing) in (the )?us\b/,
      /\bauthorized to work in the us\b/, /\bus work authorization\b/,
      /\bgreen card\b/, /\buses residents only\b/,
      // UK-specific
      /\buk[\s-]?only\b/, /\bunited kingdom only\b/,
      /\bright to work in the uk\b/,
      // EU/specific countries
      /\beu[\s-]?only\b/, /\beurope only\b/, /\bemea only\b/,
      /\bcanada only\b/, /\baustralia only\b/,
      // Timezone restrictions that imply geography
      /\best timezone (required|only|preferred)\b/,
      /\bpst timezone (required|only|preferred)\b/,
      /\b(must|need to) (work|overlap|be available).{0,30}\best\b/,
      // "based in" specific country
      /\bbased in (the )?(us|usa|uk|canada|australia|germany|france)\b/,
    ];

    return geoLockPatterns.some(pattern => pattern.test(haystack));
  }

  /**
   * Matching engine (deterministic, case-insensitive)
   */
  private matchesPreferences(job: RawJob, prefs: JobPreferences): boolean {
    const title = job.title.toLowerCase();
    const desc = (job.description || '').toLowerCase();
    const location = (job.location || '').toLowerCase();
    const company = (job.company || '').toLowerCase();
    const tags = job.tags.map(t => t.toLowerCase());

    // 1. Exclude keywords (Title or Description)
    if (prefs.excludeKeywords?.some(k => title.includes(k.toLowerCase()) || desc.includes(k.toLowerCase()))) {
      return false;
    }

    // 1b. Strict Global Remote: filter out country-locked remote jobs
    if (prefs.strictGlobalRemote && job.remote === true && this.isCountryLocked(job)) {
      return false;
    }

    // 2. Remote preference (if set)
    if (prefs.remote === true && job.remote !== true) return false;
    if (prefs.remote === false && job.remote === true) return false;

    // 3. Keywords (Title, Description, Tags, or Company)
    const hasKeyword = prefs.keywords.length === 0 || prefs.keywords.some(k => {
      const kl = k.toLowerCase();
      return title.includes(kl) || desc.includes(kl) || tags.includes(kl) || company.includes(kl);
    });

    if (!hasKeyword) return false;

    // 4. Locations (Substring match)
    if (prefs.locations?.length > 0) {
      const hasLocation = prefs.locations.some(l => location.includes(l.toLowerCase()));
      if (!hasLocation && job.remote !== true) return false; // If not remote and no location match
    }

    // 5. Experience Levels (if job specifies it)
    if (prefs.experienceLevels?.length > 0 && job.experienceLevel) {
      if (!prefs.experienceLevels.map(e => e.toLowerCase()).includes(job.experienceLevel.toLowerCase())) {
        return false;
      }
    }

    return true;
  }

  private async notifyMatch(job: any) {
    this.logger.log(`Job match found: ${job.title} at ${job.company}`);
    await this.discordService.sendJobAlert(job);
  }

  async cleanupStaleJobs() {
    const retentionDays = parseInt(process.env.JOB_RETENTION_DAYS || '14', 10);
    const deleted = await this.repository.cleanup(retentionDays);
    logEvent('info', 'jobs_cleanup', { deleted, retentionDays });
  }
}
