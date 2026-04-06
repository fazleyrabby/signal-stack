import { Module, Global } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIQueue } from './ai.queue';
import { RedisService } from './redis.service';
import { LocalProvider } from './providers/local.provider';
import { GroqProvider } from './providers/groq.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    AIService, 
    AIQueue, 
    RedisService,
    LocalProvider,
    GroqProvider, 
    OpenRouterProvider
  ],
  exports: [AIQueue],
})
export class AIModule {}
