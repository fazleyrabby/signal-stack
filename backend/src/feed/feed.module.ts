import { Module, forwardRef } from '@nestjs/common';
import { FeedService } from './feed.service';
import { FeedScheduler } from './feed.scheduler';
import { ScorerModule } from '../scorer/scorer.module';
import { SignalsModule } from '../signals/signals.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [ScorerModule, forwardRef(() => SignalsModule), forwardRef(() => AlertsModule)],
  providers: [FeedService, FeedScheduler],
  exports: [FeedService],
})
export class FeedModule {}
