import { Module } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { SignalsController } from './signals.controller';
import { SignalsRepository } from './signals.repository';
import { FeedController } from './feed.controller';
import { FeedService } from '../feed/feed.service';
import { ScorerModule } from '../scorer/scorer.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [ScorerModule, AIModule],
  controllers: [SignalsController, FeedController],
  providers: [SignalsService, SignalsRepository, FeedService],
  exports: [SignalsService, FeedService],
})
export class SignalsModule {}
