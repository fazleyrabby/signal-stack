import {
  Controller,
  Get,
  Post,
  Patch,
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
import { XPublisher } from '../publishers/x.publisher';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { signals, pulseAccounts, pulseDrafts } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { logEvent } from '../../common/logger';

@Controller('api/admin/pulse')
@UseGuards(AdminGuard)
export class DraftsController {
  constructor(
    private readonly draftsRepository: DraftsRepository,
    private readonly worker: DraftGenerationWorker,
    private readonly publisher: XPublisher,
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
  ) {}

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
    if (!existing) {
      throw new HttpException('Draft not found', HttpStatus.NOT_FOUND);
    }

    const updates: any = {};
    const logDetails: string[] = [];

    if (body.text !== undefined) {
      updates.text = body.text;
      logDetails.push('text edited');
    }

    if (body.status !== undefined) {
      updates.status = body.status;
      logDetails.push(`status changed from ${existing.status} to ${body.status}`);
    }

    if (body.scheduledAt !== undefined) {
      updates.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
      logDetails.push(body.scheduledAt ? `scheduled at ${body.scheduledAt}` : 'unscheduled');
    }

    const updated = await this.draftsRepository.updateDraft(id, updates);

    await this.draftsRepository.createPublishLog({
      draftId: id,
      platform: 'x',
      action: body.status || 'updated',
      detail: `Draft updated by admin: ${logDetails.join(', ')}`,
    });

    return updated;
  }

  @Post('drafts/:id/publish')
  async publishDraft(@Param('id') id: string) {
    const draft = await this.draftsRepository.findDraftById(id);
    if (!draft) {
      throw new HttpException('Draft not found', HttpStatus.NOT_FOUND);
    }

    const activeAccount = await this.draftsRepository.findActiveAccount('x');
    if (!activeAccount) {
      throw new HttpException('No active X publishing account configured', HttpStatus.BAD_REQUEST);
    }

    const res = await this.publisher.publish(draft.text, {
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
        platform: 'x',
        action: 'published',
        xPostId: res.postId,
        detail: `Manually published to X by admin (Post ID: ${res.postId})`,
      });

      return { success: true, postId: res.postId };
    } else {
      await this.draftsRepository.updateDraft(id, {
        status: 'failed',
      });

      await this.draftsRepository.createPublishLog({
        draftId: id,
        platform: 'x',
        action: 'failed',
        detail: `Failed to post to X manually: ${res.error}`,
      });

      throw new HttpException(`X publishing failed: ${res.error}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('enqueue/:signalId')
  async manualEnqueue(@Param('signalId') signalId: string) {
    const signalList = await this.db
      .select()
      .from(signals)
      .where(eq(signals.id, signalId))
      .limit(1);

    const signal = signalList[0];
    if (!signal) {
      throw new HttpException('Signal not found', HttpStatus.NOT_FOUND);
    }

    await this.worker.forceEnqueue({
      id: signal.id,
      title: signal.title,
      aiSummary: signal.aiSummary,
      categoryId: signal.categoryId || 'General',
      score: signal.score || 5,
    });

    return { success: true, message: 'Signal successfully enqueued for Pulse AI draft generation' };
  }

  @Get('logs')
  async getLogs() {
    return this.draftsRepository.findPublishLogs(100);
  }

  @Get('settings')
  async getSettings() {
    const autoEnabled = await this.draftsRepository.findSetting('pulse_auto_draft_enabled');
    const minScore = await this.draftsRepository.findSetting('pulse_min_signal_score');
    const maxDrafts = await this.draftsRepository.findSetting('pulse_max_drafts_per_day');

    const activeAccount = await this.draftsRepository.findActiveAccount('x');

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
    if (body.autoDraftEnabled !== undefined) {
      await this.draftsRepository.upsertSetting('pulse_auto_draft_enabled', String(body.autoDraftEnabled));
    }
    if (body.minSignalScore !== undefined) {
      await this.draftsRepository.upsertSetting('pulse_min_signal_score', String(body.minSignalScore));
    }
    if (body.maxDraftsPerDay !== undefined) {
      await this.draftsRepository.upsertSetting('pulse_max_drafts_per_day', String(body.maxDraftsPerDay));
    }

    return { success: true };
  }

  @Post('accounts')
  async connectAccount(
    @Body() body: { apiKey: string; apiSecret: string; accessToken: string; accessTokenSecret: string; handle: string },
  ) {
    // 1. Encrypt input credentials
    const encrypted = {
      apiKey: this.publisher.encrypt(body.apiKey),
      apiSecret: this.publisher.encrypt(body.apiSecret),
      accessToken: this.publisher.encrypt(body.accessToken),
      accessTokenSecret: this.publisher.encrypt(body.accessTokenSecret),
    };

    // 2. Verify with X API before saving
    const isValid = await this.publisher.verifyCredentials(encrypted);
    if (!isValid) {
      throw new HttpException('Could not verify credentials with X API. Please check your keys.', HttpStatus.BAD_REQUEST);
    }

    // 3. Mark any existing active account as inactive
    const activeAccount = await this.draftsRepository.findActiveAccount('x');
    if (activeAccount) {
      await this.draftsRepository.updateAccount(activeAccount.id, { isActive: false });
    }

    // 4. Save new active account
    const account = await this.draftsRepository.createAccount({
      platform: 'x',
      handle: body.handle.startsWith('@') ? body.handle : `@${body.handle}`,
      apiKey: encrypted.apiKey,
      apiSecret: encrypted.apiSecret,
      accessToken: encrypted.accessToken,
      accessTokenSecret: encrypted.accessTokenSecret,
      isActive: true,
    });

    logEvent('info', 'pulse_account_connected', { handle: account.handle });

    return { success: true, handle: account.handle };
  }
}
