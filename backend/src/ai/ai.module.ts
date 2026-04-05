import { Module, Global } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIQueue } from './ai.queue';
import { GroqProvider } from './providers/groq.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    AIService, 
    AIQueue, 
    GroqProvider, 
    OpenRouterProvider
  ],
  exports: [AIQueue],
})
export class AIModule {}
