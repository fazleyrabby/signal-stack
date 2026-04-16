import { Injectable, Logger } from '@nestjs/common';
import { JobsRepository } from './jobs.repository';
import { JobsFeedService } from './jobs-feed.service';
import { SettingsService } from '../ai/settings.service';
import { DiscordService } from '../alerts/discord.service';
import { JobPreferences, RawJob } from '../common/types';
import { generateHash } from '../common/hash.util';
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

    for (const raw of rawJobs) {
      const hash = generateHash(raw.title, raw.url);
      const exists = await this.repository.hashExists(hash);
      
      if (exists) continue;

      const inserted = await this.repository.insert({
        ...raw,
        hash,
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
      matches: matchesCount 
    });
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
