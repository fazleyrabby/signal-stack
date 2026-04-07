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

@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly aiService: AIService,
    private readonly aiQueue: AIQueue,
  ) {}

  // --- AI Health Check ---
  @Get('ai/health')
  async getAIHealth() {
    const health = await this.aiService.getHealth();
    return { ...health, queueSize: this.aiQueue.queueSize };
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
