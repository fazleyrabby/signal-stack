import { Module } from '@nestjs/common';
import { JobsRepository } from './jobs.repository';
import { JobsService } from './jobs.service';
import { JobsFeedService } from './jobs-feed.service';
import { JobsScheduler } from './jobs.scheduler';
import { JobsController } from './jobs.controller';
import { JobsPublicController } from './jobs-public.controller';
import { DatabaseModule } from '../database/database.module';
import { AIModule } from '../ai/ai.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [DatabaseModule, AIModule, AlertsModule],
  controllers: [JobsController, JobsPublicController],
  providers: [JobsRepository, JobsService, JobsFeedService, JobsScheduler],
  exports: [JobsService],
})
export class JobsModule {}
