import { Module, Global } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIQueue } from './ai.queue';
import { RedisService } from './redis.service';
import { SettingsService } from './settings.service';
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
    SettingsService,
    LocalProvider,
    GroqProvider, 
    OpenRouterProvider
  ],
  exports: [AIQueue, AIService, SettingsService],
})
export class AIModule {}
