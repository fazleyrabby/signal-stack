import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AIModule } from '../ai/ai.module';
import { AlertsModule } from '../alerts/alerts.module';
import { DraftsController } from './drafts/drafts.controller';
import { DraftsRepository } from './drafts/drafts.repository';
import { PulseAIService } from './services/pulse-ai.service';
import { PulseEncryptionService } from './services/pulse-encryption.service';
import { PlatformLimitsService } from './services/platform-limits.service';
import { PublisherRegistry } from './services/publisher-registry.service';
import { DraftGenerationWorker } from './workers/draft-generation.worker';
import { XPublisher } from './publishers/x.publisher';
import { FacebookPublisher } from './publishers/facebook.publisher';
import { PulseScheduler } from './scheduler/pulse.scheduler';

@Module({
  imports: [DatabaseModule, AIModule, AlertsModule],
  controllers: [DraftsController],
  providers: [
    DraftsRepository,
    PulseAIService,
    PulseEncryptionService,
    PlatformLimitsService,
    PublisherRegistry,
    DraftGenerationWorker,
    XPublisher,
    FacebookPublisher,
    PulseScheduler,
  ],
  exports: [DraftsRepository, PulseAIService, PulseEncryptionService],
})
export class PulseModule {}
