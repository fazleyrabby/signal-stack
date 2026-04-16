import { Controller, Get, Post, Put, Body, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { JobsService } from './jobs.service';
import { JobsRepository } from './jobs.repository';
import { JobPreferences } from '../common/types';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('api/admin/jobs')
@UseGuards(AdminGuard)
@SkipThrottle()
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly jobsRepository: JobsRepository,
  ) {}

  @Get()
  async getJobs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('source') source?: string,
    @Query('remote') remote?: string,
    @Query('company') company?: string,
    @Query('search') search?: string,
  ) {
    return this.jobsRepository.findAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      source,
      remote: remote === 'true' ? true : remote === 'false' ? false : undefined,
      company,
      search,
    });
  }

  @Get('preferences')
  async getPreferences() {
    return this.jobsService.getPreferences();
  }

  @Put('preferences')
  async updatePreferences(@Body() prefs: JobPreferences) {
    await this.jobsService.savePreferences(prefs);
    return { success: true };
  }

  @Post('trigger')
  async triggerFetch() {
    // Run in background to avoid timeout
    this.jobsService.processJobs();
    return { success: true, message: 'Job fetch triggered' };
  }
}
