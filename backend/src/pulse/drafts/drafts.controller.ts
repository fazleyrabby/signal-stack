import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AdminGuard } from '../../admin/admin.guard';
import { DraftsRepository } from './drafts.repository';
import { DraftGenerationWorker } from '../workers/draft-generation.worker';
import { PublisherRegistry } from '../services/publisher-registry.service';
import { PulseEncryptionService } from '../services/pulse-encryption.service';
import { PlatformLimitsService } from '../services/platform-limits.service';
import { PulseAIService } from '../services/pulse-ai.service';
import { XFormatter } from '../formatters/x.formatter';
import { FacebookFormatter } from '../formatters/facebook.formatter';
import { LinkedInFormatter } from '../formatters/linkedin.formatter';
import { BlueskyFormatter } from '../formatters/bluesky.formatter';
import type { PlatformFormatter } from '../formatters/base.formatter';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { signals, pulseAccounts, pulseAssets } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { logEvent } from '../../common/logger';

const FORMATTER_MAP = new Map<string, PlatformFormatter>([
  ['x', new XFormatter()],
  ['facebook', new FacebookFormatter()],
  ['linkedin', new LinkedInFormatter()],
  ['bluesky', new BlueskyFormatter()],
]);

@Controller('api/admin/pulse')
@UseGuards(AdminGuard)
export class DraftsController {
  constructor(
    private readonly draftsRepository: DraftsRepository,
    private readonly worker: DraftGenerationWorker,
    private readonly publisherRegistry: PublisherRegistry,
    private readonly encryption: PulseEncryptionService,
    private readonly platformLimits: PlatformLimitsService,
    private readonly pulseAI: PulseAIService,
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
  ) {}

  // ─── Assets ──────────────────────────────────────────────────────────────────

  @Get('assets')
  async getAssets(
    @Query('page') pageStr = '1',
    @Query('limit') limitStr = '20',
  ) {
    const page = parseInt(pageStr, 10) || 1;
    const limit = parseInt(limitStr, 10) || 20;
    const offset = (page - 1) * limit;

    const [assets, total] = await Promise.all([
      this.draftsRepository.findAssets({ limit, offset }),
      this.draftsRepository.countAssets(),
    ]);

    // Attach drafts to each asset so frontend workspace renders without extra requests
    const assetsWithDrafts = await Promise.all(
      assets.map(async (asset) => ({
        ...asset,
        drafts: await this.draftsRepository.findDraftsByAssetId(asset.id),
      }))
    );

    return { assets: assetsWithDrafts, total, page, limit };
  }

  @Get('assets/:id')
  async getAsset(@Param('id') id: string) {
    const asset = await this.draftsRepository.findAssetById(id);
    if (!asset) throw new HttpException('Asset not found', HttpStatus.NOT_FOUND);

    const drafts = await this.draftsRepository.findDraftsByAssetId(id);
    return { ...asset, drafts };
  }

  @Delete('assets/:id')
  async deleteAsset(@Param('id') id: string) {
    const asset = await this.draftsRepository.findAssetById(id);
    if (!asset) throw new HttpException('Asset not found', HttpStatus.NOT_FOUND);

    await this.draftsRepository.deleteAsset(id);
    logEvent('warn', 'pulse_asset_deleted', { assetId: id });
    return { success: true };
  }

  @Post('assets/:id/generate/:platform')
  async generatePlatformDraft(
    @Param('id') assetId: string,
    @Param('platform') platform: string,
  ) {
    const VALID_PLATFORMS = ['x', 'facebook', 'linkedin', 'bluesky'];
    if (!VALID_PLATFORMS.includes(platform)) {
      throw new HttpException(`Invalid platform: ${platform}`, HttpStatus.BAD_REQUEST);
    }

    const asset = await this.draftsRepository.findAssetById(assetId);
    if (!asset) throw new HttpException('Asset not found', HttpStatus.NOT_FOUND);

    const formatter = FORMATTER_MAP.get(platform);
    if (!formatter) throw new HttpException(`No formatter for platform: ${platform}`, HttpStatus.BAD_REQUEST);

    // Check for existing non-published draft for this asset+platform
    const existing = await this.draftsRepository.findDraftByAssetAndPlatform(assetId, platform);
    if (existing && existing.status !== 'published') {
      // Regenerate: delete old and create fresh
      await this.draftsRepository.deleteDraft(existing.id);
    }

    const post = formatter.format({
      title: asset.title,
      executiveSummary: asset.executiveSummary,
      detailedSummary: asset.detailedSummary ?? undefined,
      technicalBreakdown: asset.technicalBreakdown ?? undefined,
      whyItMatters: asset.whyItMatters ?? undefined,
      keyPoints: (asset.keyPoints as string[]) ?? undefined,
      sourceUrl: asset.sourceUrl ?? undefined,
      relatedLinks: (asset.relatedLinks as string[]) ?? undefined,
      tags: (asset.tags as string[]) ?? undefined,
      category: asset.category ?? undefined,
      severity: asset.severity ?? undefined,
    });

    const draft = await this.draftsRepository.createDraft({
      sourceSignalId: asset.signalId,
      assetId,
      platform,
      text: post.text,
      status: 'generated',
      aiProvider: asset.aiProvider ?? 'formatter',
      aiModel: asset.aiModel ?? 'template',
    });

    await this.draftsRepository.createPublishLog({
      draftId: draft.id,
      platform,
      action: 'generated',
      detail: `${platform} variant generated on demand from asset ${assetId}`,
    });

    logEvent('info', 'pulse_variant_generated', { assetId, platform, draftId: draft.id });
    return draft;
  }

  @Post('assets/:id/regenerate/:platform')
  async regeneratePlatformDraft(
    @Param('id') assetId: string,
    @Param('platform') platform: string,
  ) {
    return this.generatePlatformDraft(assetId, platform);
  }

  // ─── Drafts ──────────────────────────────────────────────────────────────────

  @Get('drafts')
  async getDrafts(
    @Query('status') status = 'all',
    @Query('page') pageStr = '1',
    @Query('limit') limitStr = '10',
  ) {
    const page = parseInt(pageStr, 10) || 1;
    const limit = parseInt(limitStr, 10) || 10;
    const offset = (page - 1) * limit;

    const [drafts, total] = await Promise.all([
      this.draftsRepository.findDrafts({ status, limit, offset }),
      this.draftsRepository.countDrafts(status),
    ]);

    return { drafts, total, page, limit };
  }

  @Patch('drafts/:id')
  async updateDraft(
    @Param('id') id: string,
    @Body() body: { status?: string; text?: string; scheduledAt?: string | null },
  ) {
    const existing = await this.draftsRepository.findDraftById(id);
    if (!existing) throw new HttpException('Draft not found', HttpStatus.NOT_FOUND);

    const updates: any = {};
    const logDetails: string[] = [];

    if (body.text !== undefined) {
      updates.text = body.text;
      logDetails.push('text edited');
    }

    if (body.status !== undefined) {
      updates.status = body.status;
      logDetails.push(`status → ${body.status}`);
    }

    if (body.scheduledAt !== undefined) {
      if (body.scheduledAt) {
        const scheduled = new Date(body.scheduledAt);
        if (scheduled <= new Date()) {
          throw new HttpException(
            'scheduledAt must be a future date/time',
            HttpStatus.BAD_REQUEST,
          );
        }
        updates.scheduledAt = scheduled;
        logDetails.push(`scheduled at ${body.scheduledAt}`);
      } else {
        updates.scheduledAt = null;
        logDetails.push('unscheduled');
      }
    }

    const updated = await this.draftsRepository.updateDraft(id, updates);

    await this.draftsRepository.createPublishLog({
      draftId: id,
      platform: existing.platform || 'x',
      action: body.status || 'updated',
      detail: `Draft updated by admin: ${logDetails.join(', ')}`,
    });

    return updated;
  }

  @Delete('drafts/:id')
  async deleteDraft(@Param('id') id: string) {
    const draft = await this.draftsRepository.findDraftById(id);
    if (!draft) throw new HttpException('Draft not found', HttpStatus.NOT_FOUND);

    // Write audit log before deleting so the history survives
    await this.draftsRepository.createPublishLog({
      draftId: id,
      platform: draft.platform || 'x',
      action: 'deleted',
      detail: `Draft permanently deleted by admin (was: ${draft.status})`,
    });

    await this.draftsRepository.deleteDraft(id);
    logEvent('warn', 'pulse_draft_deleted', { draftId: id, status: draft.status });

    return { success: true };
  }

  @Post('drafts/:id/publish')
  async publishDraft(@Param('id') id: string) {
    const draft = await this.draftsRepository.findDraftById(id);
    if (!draft) throw new HttpException('Draft not found', HttpStatus.NOT_FOUND);

    const platform = draft.platform || 'x';
    const activeAccount = await this.draftsRepository.findActiveAccount(platform);
    if (!activeAccount) {
      throw new HttpException(`No active ${platform} publishing account configured`, HttpStatus.BAD_REQUEST);
    }

    const publisher = this.publisherRegistry.getPublisher(platform);
    if (!publisher) {
      throw new HttpException(`No publisher available for platform: ${platform}`, HttpStatus.BAD_REQUEST);
    }

    const res = await publisher.publish(draft.text, {
      apiKey: activeAccount.apiKey,
      apiSecret: activeAccount.apiSecret,
      accessToken: activeAccount.accessToken,
      accessTokenSecret: activeAccount.accessTokenSecret,
    });

    if (res.success) {
      await this.draftsRepository.updateDraft(id, {
        status: 'published',
        publishedAt: new Date(),
      });
      await this.draftsRepository.createPublishLog({
        draftId: id,
        platform,
        action: 'published',
        xPostId: res.postId,
        detail: `Manually published to ${platform} by admin (Post ID: ${res.postId})`,
      });
      return { success: true, postId: res.postId };
    } else {
      await this.draftsRepository.updateDraft(id, { status: 'failed' });
      await this.draftsRepository.createPublishLog({
        draftId: id,
        platform,
        action: 'failed',
        detail: `Failed to publish to ${platform} manually: ${res.error}`,
      });
      throw new HttpException(`${platform} publishing failed: ${res.error}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('drafts/:id/retry')
  async retryDraft(@Param('id') id: string) {
    const draft = await this.draftsRepository.findDraftById(id);
    if (!draft) throw new HttpException('Draft not found', HttpStatus.NOT_FOUND);

    if (draft.status !== 'failed') {
      throw new HttpException(
        'Only failed drafts can be retried',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!draft.sourceSignalId) {
      throw new HttpException('Draft has no source signal to re-generate from', HttpStatus.BAD_REQUEST);
    }

    // Load the source signal
    const signalRows = await this.db
      .select()
      .from(signals)
      .where(eq(signals.id, draft.sourceSignalId))
      .limit(1);

    const signal = signalRows[0];
    if (!signal) throw new HttpException('Source signal not found', HttpStatus.NOT_FOUND);

    // Reset draft state so it can be re-generated
    await this.draftsRepository.updateDraft(id, {
      status: 'pending',
      retryCount: 0,
    });

    // Force enqueue for re-generation (bypasses daily limits — admin explicit action)
    await this.worker.forceEnqueue({
      id: signal.id,
      title: signal.title,
      aiSummary: signal.aiSummary,
      categoryId: signal.categoryId || 'General',
      score: signal.score || 5,
    });

    await this.draftsRepository.createPublishLog({
      draftId: id,
      platform: draft.platform || 'x',
      action: 'generated',
      detail: 'Admin triggered retry of failed AI generation',
    });

    logEvent('info', 'pulse_draft_retry_triggered', { draftId: id, signalId: signal.id });
    return { success: true, message: 'Draft re-queued for AI generation' };
  }

  // ─── Manual Enqueue ──────────────────────────────────────────────────────────

  @Post('enqueue/:signalId')
  async manualEnqueue(@Param('signalId') signalId: string) {
    const signalList = await this.db
      .select()
      .from(signals)
      .where(eq(signals.id, signalId))
      .limit(1);

    const signal = signalList[0];
    if (!signal) throw new HttpException('Signal not found', HttpStatus.NOT_FOUND);

    // If asset already exists, return it instead of re-generating
    const existing = await this.draftsRepository.findAssetBySignalId(signalId);
    if (existing) {
      return { success: true, alreadyExists: true, assetId: existing.id, message: 'Intelligence asset already exists for this signal' };
    }

    await this.worker.forceEnqueue({
      id: signal.id,
      title: signal.title,
      aiSummary: signal.aiSummary,
      categoryId: signal.categoryId || 'General',
      score: signal.score || 5,
      sourceUrl: signal.url,
    });

    return { success: true, alreadyExists: false, message: 'Signal queued for intelligence asset generation' };
  }

  // ─── Logs ────────────────────────────────────────────────────────────────────

  @Get('logs')
  async getLogs() {
    return this.draftsRepository.findPublishLogs(100);
  }

  // ─── Settings ────────────────────────────────────────────────────────────────

  @Get('settings')
  async getSettings() {
    const [autoEnabled, minScore, maxDrafts, activeAccount] = await Promise.all([
      this.draftsRepository.findSetting('pulse_auto_draft_enabled'),
      this.draftsRepository.findSetting('pulse_min_signal_score'),
      this.draftsRepository.findSetting('pulse_max_drafts_per_day'),
      this.draftsRepository.findActiveAccount('x'),
    ]);

    return {
      autoDraftEnabled: autoEnabled !== 'false',
      minSignalScore: minScore ? parseFloat(minScore) : 7,
      maxDraftsPerDay: maxDrafts ? parseInt(maxDrafts, 10) : 20,
      xConnected: !!activeAccount,
      xHandle: activeAccount?.handle || null,
    };
  }

  @Patch('settings')
  async updateSettings(
    @Body() body: { autoDraftEnabled?: boolean; minSignalScore?: number; maxDraftsPerDay?: number },
  ) {
    const updates: Promise<void>[] = [];

    if (body.autoDraftEnabled !== undefined) {
      updates.push(this.draftsRepository.upsertSetting('pulse_auto_draft_enabled', String(body.autoDraftEnabled)));
    }
    if (body.minSignalScore !== undefined) {
      updates.push(this.draftsRepository.upsertSetting('pulse_min_signal_score', String(body.minSignalScore)));
    }
    if (body.maxDraftsPerDay !== undefined) {
      updates.push(this.draftsRepository.upsertSetting('pulse_max_drafts_per_day', String(body.maxDraftsPerDay)));
    }

    await Promise.all(updates);
    return { success: true };
  }

  // ─── Platform Limits ─────────────────────────────────────────────────────────

  @Get('platform-limits')
  async getPlatformLimits() {
    return this.platformLimits.getAllPlatformStatus();
  }

  @Patch('platform-limits')
  async updatePlatformLimits(
    @Body() body: { platform: string; dailyLimit?: number; hourlyLimit?: number },
  ) {
    if (!body.platform) {
      throw new HttpException('platform is required', HttpStatus.BAD_REQUEST);
    }
    await this.platformLimits.setPlatformLimits(body.platform, {
      dailyLimit: body.dailyLimit,
      hourlyLimit: body.hourlyLimit,
    });
    return { success: true };
  }

  // ─── Accounts ────────────────────────────────────────────────────────────────

  @Get('accounts')
  async getAccounts(@Query('platform') platform?: string) {
    const accounts = await this.draftsRepository.findAllAccounts(platform);
    // Return accounts with masked credentials (show handle and metadata only)
    return accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      handle: a.handle,
      isActive: a.isActive,
      createdAt: a.createdAt,
    }));
  }

  @Post('accounts')
  async connectAccount(
    @Body() body: {
      apiKey: string;
      apiSecret: string;
      accessToken: string;
      accessTokenSecret: string;
      handle: string;
      platform?: string;
    },
  ) {
    const platform = body.platform || 'x';

    const encrypted = {
      apiKey: this.encryption.encrypt(body.apiKey),
      apiSecret: this.encryption.encrypt(body.apiSecret),
      accessToken: this.encryption.encrypt(body.accessToken),
      accessTokenSecret: this.encryption.encrypt(body.accessTokenSecret),
    };

    const publisher = this.publisherRegistry.getPublisher(platform);
    if (publisher?.verifyCredentials) {
      const isValid = await publisher.verifyCredentials(encrypted);
      if (!isValid) {
        throw new HttpException(
          `Could not verify credentials with ${platform} API. Please check your keys.`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Deactivate existing active account for this platform
    const activeAccount = await this.draftsRepository.findActiveAccount(platform);
    if (activeAccount) {
      await this.draftsRepository.updateAccount(activeAccount.id, { isActive: false });
    }

    const account = await this.draftsRepository.createAccount({
      platform,
      handle: body.handle.startsWith('@') ? body.handle : `@${body.handle}`,
      apiKey: encrypted.apiKey,
      apiSecret: encrypted.apiSecret,
      accessToken: encrypted.accessToken,
      accessTokenSecret: encrypted.accessTokenSecret,
      isActive: true,
    });

    logEvent('info', 'pulse_account_connected', { handle: account.handle, platform });
    return { success: true, handle: account.handle };
  }

  @Get('accounts/:id/credentials')
  async getAccountCredentials(@Param('id') id: string) {
    const rows = await this.db
      .select()
      .from(pulseAccounts)
      .where(eq(pulseAccounts.id, id))
      .limit(1);

    const account = rows[0];
    if (!account) throw new HttpException('Account not found', HttpStatus.NOT_FOUND);

    return {
      id: account.id,
      platform: account.platform,
      handle: account.handle.replace(/^@/, ''),
      apiKey: this.encryption.decrypt(account.apiKey),
      apiSecret: this.encryption.decrypt(account.apiSecret),
      accessToken: this.encryption.decrypt(account.accessToken),
      accessTokenSecret: this.encryption.decrypt(account.accessTokenSecret),
    };
  }

  @Patch('accounts/:id')
  async updateAccount(
    @Param('id') id: string,
    @Body() body: {
      apiKey?: string;
      apiSecret?: string;
      accessToken?: string;
      accessTokenSecret?: string;
      handle?: string;
    },
  ) {
    const rows = await this.db
      .select()
      .from(pulseAccounts)
      .where(eq(pulseAccounts.id, id))
      .limit(1);

    const account = rows[0];
    if (!account) throw new HttpException('Account not found', HttpStatus.NOT_FOUND);

    const updates: Partial<typeof account> = {};

    if (body.handle) {
      updates.handle = body.handle.startsWith('@') ? body.handle : `@${body.handle}`;
    }
    if (body.apiKey) updates.apiKey = this.encryption.encrypt(body.apiKey);
    if (body.apiSecret) updates.apiSecret = this.encryption.encrypt(body.apiSecret);
    if (body.accessToken) updates.accessToken = this.encryption.encrypt(body.accessToken);
    if (body.accessTokenSecret) updates.accessTokenSecret = this.encryption.encrypt(body.accessTokenSecret);

    if (Object.keys(updates).length > 0) {
      // Verify updated credentials if publisher supports it
      const mergedEncrypted = {
        apiKey: updates.apiKey ?? account.apiKey,
        apiSecret: updates.apiSecret ?? account.apiSecret,
        accessToken: updates.accessToken ?? account.accessToken,
        accessTokenSecret: updates.accessTokenSecret ?? account.accessTokenSecret,
      };

      const publisher = this.publisherRegistry.getPublisher(account.platform);
      if (publisher?.verifyCredentials) {
        const isValid = await publisher.verifyCredentials(mergedEncrypted);
        if (!isValid) {
          throw new HttpException(
            `Could not verify updated credentials with ${account.platform} API.`,
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      await this.draftsRepository.updateAccount(id, updates as any);
    }

    logEvent('info', 'pulse_account_updated', { accountId: id, handle: account.handle });
    return { success: true };
  }

  @Patch('accounts/:id/activate')
  async activateAccount(@Param('id') id: string) {
    const rows = await this.db
      .select()
      .from(pulseAccounts)
      .where(eq(pulseAccounts.id, id))
      .limit(1);

    const account = rows[0];
    if (!account) throw new HttpException('Account not found', HttpStatus.NOT_FOUND);

    await this.draftsRepository.setActiveAccount(id, account.platform);
    logEvent('info', 'pulse_account_activated', { accountId: id, handle: account.handle });
    return { success: true, handle: account.handle };
  }

  @Delete('accounts/:id')
  async deleteAccount(@Param('id') id: string) {
    const rows = await this.db
      .select()
      .from(pulseAccounts)
      .where(eq(pulseAccounts.id, id))
      .limit(1);

    const account = rows[0];
    if (!account) throw new HttpException('Account not found', HttpStatus.NOT_FOUND);

    if (account.isActive) {
      throw new HttpException(
        'Cannot delete the active publishing account. Activate another account first.',
        HttpStatus.CONFLICT,
      );
    }

    await this.draftsRepository.deleteAccount(id);
    logEvent('info', 'pulse_account_deleted', { accountId: id, handle: account.handle });
    return { success: true };
  }
}
