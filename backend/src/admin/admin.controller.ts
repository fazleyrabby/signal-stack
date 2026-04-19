import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AdminService } from './admin.service';
import { AIService } from '../ai/ai.service';
import { AIQueue } from '../ai/ai.queue';
import { AdminGuard } from './admin.guard';
import { MetricsService } from '../ai/metrics.service';
import { SettingsService } from '../ai/settings.service';
import { EmailService } from '../alerts/email.service';
import {
  fetchGroqModels,
  fetchOpenRouterModels,
  STATIC_FREE_MODELS,
} from '../ai/models';
import { ConfigService } from '@nestjs/config';
import { DiscordService } from '../alerts/discord.service';
import { GroqProvider } from '../ai/providers/groq.provider';
import { OpenRouterProvider } from '../ai/providers/openrouter.provider';
import { MacLocalProvider } from '../ai/providers/mac-local.provider';
import { CompaniesService } from '../companies/companies.service';

@Controller('api/admin')
@UseGuards(AdminGuard)
@SkipThrottle()
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly aiService: AIService,
    private readonly aiQueue: AIQueue,
    private readonly settingsService: SettingsService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
    private readonly discordService: DiscordService,
    private readonly groqProvider: GroqProvider,
    private readonly openRouterProvider: OpenRouterProvider,
    private readonly macLocalProvider: MacLocalProvider,
    private readonly companiesService: CompaniesService,
  ) {}

  // --- AI Health Check ---
  @Get('ai/health')
  async getAIHealth() {
    const health = await this.aiService.getHealth();
    return { ...health, queueSize: this.aiQueue.queueSize };
  }

  // --- AI Pipeline ---
  @Get('ai/pipeline')
  async getPipeline() {
    const config = await this.settingsService.getModelConfig();
    const health = await this.aiService.getHealth();
    return {
      summarization: config.summarizationPipeline,
      translation: config.translationPipeline,
      providerHealth: {
        mac_local: health.macLocal,
        pico_router: health.picoClaw,
        groq: health.groq,
        openrouter: health.openrouter,
        local: health.local,
      },
    };
  }

  @Put('ai/pipeline')
  async setPipeline(@Body() body: { summarization: string[]; translation: string[] }) {
    await this.settingsService.setSetting('summarization_pipeline', JSON.stringify(body.summarization));
    await this.settingsService.setSetting('translation_pipeline', JSON.stringify(body.translation));
    return { ok: true };
  }

  // --- Mac Local ---
  @Get('ai/mac-local/config')
  async getMacLocalConfig() {
    const config = await this.settingsService.getModelConfig();
    return {
      enabled: config.macLocalEnabled,
      endpoint: config.macLocalEndpoint,
      timeout: config.macLocalTimeout,
    };
  }

  @Put('ai/mac-local/config')
  async updateMacLocalConfig(
    @Body() body: { enabled?: boolean; endpoint?: string; timeout?: number },
  ) {
    await this.settingsService.setModelConfig({
      macLocalEnabled: body.enabled,
      macLocalEndpoint: body.endpoint,
      macLocalTimeout: body.timeout,
    });
    return { success: true };
  }

  @Post('ai/mac-local/test')
  async testMacLocal() {
    return this.macLocalProvider.checkHealth();
  }

  // --- LLM Models ---
  @Get('ai/models')
  async getAvailableModels() {
    const config = await this.settingsService.getModelConfig();

    // Try to get cached models first
    const cached = await this.settingsService.getCachedModels();

    if (cached) {
      return {
        groq: cached.groq,
        openrouter: cached.openrouter,
        selected: config,
        cached: true,
      };
    }

    // Fetch fresh models if no cache — DB keys take priority over env
    const [groqKey, openrouterKey] = await this.getEffectiveApiKeys();

    const [groqModels, openrouterModels] = await Promise.all([
      groqKey
        ? fetchGroqModels(groqKey)
        : Promise.resolve(STATIC_FREE_MODELS.groq),
      openrouterKey
        ? fetchOpenRouterModels(openrouterKey)
        : Promise.resolve(STATIC_FREE_MODELS.openrouter),
    ]);

    // Cache the results
    await this.settingsService.setCachedModels({
      groq: groqModels.length > 0 ? groqModels : STATIC_FREE_MODELS.groq,
      openrouter:
        openrouterModels.length > 0
          ? openrouterModels
          : STATIC_FREE_MODELS.openrouter,
      fetchedAt: Date.now(),
    });

    return {
      groq: groqModels.length > 0 ? groqModels : STATIC_FREE_MODELS.groq,
      openrouter:
        openrouterModels.length > 0
          ? openrouterModels
          : STATIC_FREE_MODELS.openrouter,
      selected: config,
    };
  }

  private async getEffectiveApiKeys(): Promise<[string | undefined, string | undefined]> {
    const [groqDb, openrouterDb] = await Promise.all([
      this.settingsService.getSetting('groq_api_key'),
      this.settingsService.getSetting('openrouter_api_key'),
    ]);
    return [
      groqDb || this.configService.get<string>('GROQ_API_KEY'),
      openrouterDb || this.configService.get<string>('OPENROUTER_API_KEY'),
    ];
  }

  @Post('ai/models/refresh')
  async refreshModelsCache() {
    const [groqKey, openrouterKey] = await this.getEffectiveApiKeys();

    const [groqModels, openrouterModels] = await Promise.all([
      groqKey
        ? fetchGroqModels(groqKey)
        : Promise.resolve(STATIC_FREE_MODELS.groq),
      openrouterKey
        ? fetchOpenRouterModels(openrouterKey)
        : Promise.resolve(STATIC_FREE_MODELS.openrouter),
    ]);

    await this.settingsService.setCachedModels({
      groq: groqModels.length > 0 ? groqModels : STATIC_FREE_MODELS.groq,
      openrouter:
        openrouterModels.length > 0
          ? openrouterModels
          : STATIC_FREE_MODELS.openrouter,
      fetchedAt: Date.now(),
    });

    return { success: true };
  }

  @Put('ai/models')
  async updateModelConfig(
    @Body() body: { provider: 'groq' | 'openrouter' | 'local'; modelId?: string; enabled?: boolean },
  ) {
    const { provider, modelId, enabled } = body;
    if (provider === 'groq' && modelId) {
      await this.settingsService.setModelConfig({ groqModel: modelId });
    } else if (provider === 'openrouter' && modelId) {
      await this.settingsService.setModelConfig({ openrouterModel: modelId });
    } else if (provider === 'local' && enabled !== undefined) {
      await this.settingsService.setModelConfig({ localAiEnabled: enabled });
    }
    return { success: true };
  }

  // --- Categories ---

  @Get('categories')
  async getCategories() {
    return this.adminService.getCategories();
  }

  @Post('categories')
  async createCategory(@Body() data: any) {
    return this.adminService.createCategory(data);
  }

  @Put('categories/:slug')
  async updateCategory(@Param('slug') slug: string, @Body() data: any) {
    return this.adminService.updateCategory(slug, data);
  }

  @Delete('categories/:slug')
  async deleteCategory(@Param('slug') slug: string) {
    return this.adminService.deleteCategory(slug);
  }

  // --- Sources ---

  @Get('sources')
  async getSources() {
    return this.adminService.getSources();
  }

  @Post('sources')
  async createSource(@Body() data: any) {
    return this.adminService.createSource(data);
  }

  @Put('sources/:id')
  async updateSource(@Param('id') id: string, @Body() data: any) {
    return this.adminService.updateSource(id, data);
  }

  @Delete('sources/:id')
  async deleteSource(@Param('id') id: string) {
    return this.adminService.deleteSource(id);
  }

  // --- AI Retry ---

  @Post('ai/retry')
  async retryFailedAI() {
    const failed = await this.adminService.getFailedAISignals();
    let queued = 0;
    for (const signal of failed) {
      await this.aiQueue.enqueue({
        id: signal.id,
        title: signal.title,
        content: signal.content,
        score: signal.score,
      });
      queued++;
    }
    return { queued, total: failed.length };
  }

  @Post('ai/cleanup')
  async retryBoilerplate() {
    const reset = await this.adminService.resetBoilerplateSignals();
    let queued = 0;
    for (const signal of reset) {
      await this.aiQueue.enqueue({
        id: signal.id,
        title: signal.title,
        content: signal.content,
        score: signal.score,
      });
      queued++;
    }
    return { queued, total: reset.length };
  }

  @Post('ai/retry/high')
  async retryHighSeverity() {
    const high = await this.adminService.getHighSeverityUnprocessed();
    let queued = 0;
    for (const signal of high) {
      await this.aiQueue.enqueue({
        id: signal.id,
        title: signal.title,
        content: signal.content,
        score: signal.score,
      });
      queued++;
    }
    return { queued, total: high.length };
  }

  // --- System ---

  @Post('backup')
  async triggerBackup() {
    console.log('🏁 Admin API: Triggering manual database backup...');
    try {
      const result = await this.adminService.triggerBackup();
      console.log('✅ Admin API: Backup successful');
      return result;
    } catch (err) {
      console.error(`❌ Admin API: Backup failed: ${err.message}`);
      throw err;
    }
  }

  // --- Metrics ---
  @Get('metrics')
  async getMetrics() {
    return this.metricsService.getMetrics();
  }

  // --- Discord Webhooks ---
  @Get('webhooks')
  async getWebhooks() {
    const storedMain = await this.settingsService.getSetting('discord_webhook_url');
    const storedJobs = await this.settingsService.getSetting('discord_jobs_webhook_url');
    // Fall back to env vars for display (masked)
    const envMain = this.configService.get<string>('DISCORD_WEBHOOK_URL') || '';
    const envJobs = this.configService.get<string>('DISCORD_JOBS_WEBHOOK_URL') || '';
    return {
      webhookUrl: storedMain ?? envMain,
      jobsWebhookUrl: storedJobs ?? envJobs,
    };
  }

  @Put('webhooks')
  async updateWebhooks(@Body() body: { webhookUrl?: string; jobsWebhookUrl?: string }) {
    const { webhookUrl, jobsWebhookUrl } = body;
    if (webhookUrl !== undefined) {
      await this.settingsService.setSetting('discord_webhook_url', webhookUrl);
    }
    if (jobsWebhookUrl !== undefined) {
      await this.settingsService.setSetting('discord_jobs_webhook_url', jobsWebhookUrl);
    }
    this.discordService.updateWebhookUrls(webhookUrl, jobsWebhookUrl);
    return { success: true };
  }

  @Post('webhooks/test')
  async testWebhook(@Body() body: { type: 'signals' | 'jobs' }) {
    const urls = this.discordService.getWebhookUrls();
    const url = body.type === 'jobs' ? urls.jobsWebhookUrl : urls.webhookUrl;
    if (!url) {
      return { success: false, error: 'No webhook URL configured' };
    }
    const payload = body.type === 'jobs'
      ? {
          embeds: [{
            title: '🧪 Test: SignalStack Jobs Webhook',
            description: 'Jobs webhook is connected and operational.',
            color: 0x0077b5,
            footer: { text: 'SignalStack Jobs · Test Message' },
            timestamp: new Date().toISOString(),
          }],
        }
      : {
          embeds: [{
            title: '🧪 Test: SignalStack Signals Webhook',
            description: 'Signals webhook is connected and operational.',
            color: 0x00ff00,
            footer: { text: 'SignalStack · Test Message' },
            timestamp: new Date().toISOString(),
          }],
        };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Discord returned ${res.status}: ${text}` };
    }
    return { success: true };
  }

  // --- API Keys ---
  @Get('keys')
  async getApiKeys() {
    const groqStored = await this.settingsService.getSetting('groq_api_key');
    const openrouterStored = await this.settingsService.getSetting('openrouter_api_key');
    const googleStored = await this.settingsService.getSetting('google_places_api_key');
    const mapboxStored = await this.settingsService.getSetting('mapbox_api_key');
    // Return masked values — never expose full key
    const mask = (k: string | null, env: string | undefined) => {
      const val = k ?? env ?? '';
      if (!val) return '';
      return val.slice(0, 6) + '••••••••••••••••' + val.slice(-4);
    };
    return {
      groq: {
        masked: mask(groqStored, this.configService.get('GROQ_API_KEY')),
        source: groqStored ? 'db' : (this.configService.get('GROQ_API_KEY') ? 'env' : 'none'),
      },
      openrouter: {
        masked: mask(openrouterStored, this.configService.get('OPENROUTER_API_KEY')),
        source: openrouterStored ? 'db' : (this.configService.get('OPENROUTER_API_KEY') ? 'env' : 'none'),
      },
      google: {
        masked: mask(googleStored, this.configService.get('GOOGLE_PLACES_API_KEY')),
        source: googleStored ? 'db' : (this.configService.get('GOOGLE_PLACES_API_KEY') ? 'env' : 'none'),
      },
      mapbox: {
        masked: mask(mapboxStored, this.configService.get('MAPBOX_API_KEY')),
        source: mapboxStored ? 'db' : (this.configService.get('MAPBOX_API_KEY') ? 'env' : 'none'),
      },
    };
  }

  @Put('keys')
  async updateApiKeys(@Body() body: { provider: 'groq' | 'openrouter' | 'google' | 'mapbox'; key: string }) {
    const { provider, key } = body;
    if (provider === 'groq') {
      await this.settingsService.setSetting('groq_api_key', key);
      this.groqProvider.updateApiKey(key);
    } else if (provider === 'openrouter') {
      await this.settingsService.setSetting('openrouter_api_key', key);
      this.openRouterProvider.updateApiKey(key);
    } else if (provider === 'google') {
      await this.settingsService.setSetting('google_places_api_key', key);
    } else if (provider === 'mapbox') {
      await this.settingsService.setSetting('mapbox_api_key', key);
    }
    return { success: true };
  }

  @Post('keys/test')
  async testApiKey(@Body() body: { provider: 'groq' | 'openrouter' | 'google' | 'mapbox' }) {
    const { provider } = body;
    let result: { status: string; error?: string };

    if (provider === 'groq') {
      result = await this.groqProvider.checkHealth();
    } else if (provider === 'openrouter') {
      result = await this.openRouterProvider.checkHealth();
    } else if (provider === 'mapbox') {
      result = await this.companiesService.checkMapboxHealth();
    } else if (provider === 'google') {
      result = await this.companiesService.checkGoogleHealth();
    } else {
      throw new Error('Invalid provider');
    }

    return result;
  }

  // --- Cache Management ---
  @Get('cache')
  async getCacheStats() {
    return this.adminService.getCacheStats();
  }

  @Delete('cache')
  async clearAllCache() {
    return this.adminService.clearAllCache();
  }

  @Delete('cache/:id')
  async clearCacheGroup(@Param('id') id: string) {
    return this.adminService.clearCacheGroup(id);
  }

  // --- Email Digest ---
  @Post('digest/test')
  async triggerTestDigest() {
    // Get admin email from request or config
    const adminEmail =
      this.configService.get<string>('ADMIN_EMAIL') ||
      this.configService.get<string>('SMTP_USER');
    if (!adminEmail) {
      throw new Error('No admin email configured for test digest');
    }
    await this.emailService.sendTestDigest(adminEmail);
    return { success: true, message: `Test digest sent to ${adminEmail}` };
  }
}
