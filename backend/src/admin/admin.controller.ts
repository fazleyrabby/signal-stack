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
import { AdminService } from './admin.service';
import { AIService } from '../ai/ai.service';
import { AIQueue } from '../ai/ai.queue';
import { AdminGuard } from './admin.guard';
import { SettingsService } from '../ai/settings.service';
import { fetchGroqModels, fetchOpenRouterModels, STATIC_FREE_MODELS } from '../ai/models';
import { ConfigService } from '@nestjs/config';

@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly aiService: AIService,
    private readonly aiQueue: AIQueue,
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
  ) {}

  // --- AI Health Check ---
  @Get('ai/health')
  async getAIHealth() {
    const health = await this.aiService.getHealth();
    return { ...health, queueSize: this.aiQueue.queueSize };
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

    // Fetch fresh models if no cache
    const groqKey = this.configService.get<string>('GROQ_API_KEY');
    const openrouterKey = this.configService.get<string>('OPENROUTER_API_KEY');

    const [groqModels, openrouterModels] = await Promise.all([
      groqKey ? fetchGroqModels(groqKey) : Promise.resolve(STATIC_FREE_MODELS.groq),
      openrouterKey ? fetchOpenRouterModels(openrouterKey) : Promise.resolve(STATIC_FREE_MODELS.openrouter),
    ]);

    // Cache the results
    await this.settingsService.setCachedModels({
      groq: groqModels.length > 0 ? groqModels : STATIC_FREE_MODELS.groq,
      openrouter: openrouterModels.length > 0 ? openrouterModels : STATIC_FREE_MODELS.openrouter,
      fetchedAt: Date.now(),
    });

    return {
      groq: groqModels.length > 0 ? groqModels : STATIC_FREE_MODELS.groq,
      openrouter: openrouterModels.length > 0 ? openrouterModels : STATIC_FREE_MODELS.openrouter,
      selected: config,
    };
  }

  @Post('ai/models/refresh')
  async refreshModelsCache() {
    const groqKey = this.configService.get<string>('GROQ_API_KEY');
    const openrouterKey = this.configService.get<string>('OPENROUTER_API_KEY');

    const [groqModels, openrouterModels] = await Promise.all([
      groqKey ? fetchGroqModels(groqKey) : Promise.resolve(STATIC_FREE_MODELS.groq),
      openrouterKey ? fetchOpenRouterModels(openrouterKey) : Promise.resolve(STATIC_FREE_MODELS.openrouter),
    ]);

    await this.settingsService.setCachedModels({
      groq: groqModels.length > 0 ? groqModels : STATIC_FREE_MODELS.groq,
      openrouter: openrouterModels.length > 0 ? openrouterModels : STATIC_FREE_MODELS.openrouter,
      fetchedAt: Date.now(),
    });

    return { success: true };
  }

  @Put('ai/models')
  async updateModelConfig(@Body() body: { provider: 'groq' | 'openrouter'; modelId: string }) {
    const { provider, modelId } = body;
    if (provider === 'groq') {
      await this.settingsService.setModelConfig({ groqModel: modelId });
    } else if (provider === 'openrouter') {
      await this.settingsService.setModelConfig({ openrouterModel: modelId });
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
}
