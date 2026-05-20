import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AIModule } from '../ai/ai.module';
import { DraftsController } from './drafts/drafts.controller';
import { DraftsRepository } from './drafts/drafts.repository';
import { PulseAIService } from './services/pulse-ai.service';
import { DraftGenerationWorker } from './workers/draft-generation.worker';
import { XPublisher } from './publishers/x.publisher';
import { PulseScheduler } from './scheduler/pulse.scheduler';

@Module({
  imports: [DatabaseModule, AIModule],
  controllers: [DraftsController],
  providers: [
    DraftsRepository,
    PulseAIService,
    DraftGenerationWorker,
    XPublisher,
    PulseScheduler,
  ],
  exports: [DraftsRepository, PulseAIService],
})
export class PulseModule {}
