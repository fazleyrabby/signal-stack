import { Controller, Get, Query } from '@nestjs/common';
import { JobsRepository } from './jobs.repository';

@Controller('api/jobs')
export class JobsPublicController {
  constructor(private readonly jobsRepository: JobsRepository) {}

  @Get()
  async getJobs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('remote') remote?: string,
    @Query('search') search?: string,
    @Query('source') source?: string,
  ) {
    return this.jobsRepository.findAll({
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 50),
      source,
      remote: remote === 'true' ? true : remote === 'false' ? false : undefined,
      search,
    });
  }
}
