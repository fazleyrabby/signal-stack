import { Module } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { SignalsController } from './signals.controller';
import { SignalsRepository } from './signals.repository';
import { FeedService } from '../feed/feed.service';
import { ScorerModule } from '../scorer/scorer.module';

@Module({
  imports: [ScorerModule],
  controllers: [SignalsController],
  providers: [SignalsService, SignalsRepository, FeedService],
  exports: [SignalsService, FeedService],
})
export class SignalsModule {}
