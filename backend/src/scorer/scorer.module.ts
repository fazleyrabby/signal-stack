import { Module } from '@nestjs/common';
import { ScorerService } from './scorer.service';
import { AIService } from './ai.service';

@Module({
  providers: [ScorerService, AIService],
  exports: [ScorerService],
})
export class ScorerModule {}
