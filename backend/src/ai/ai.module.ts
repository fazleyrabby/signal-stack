import { Module, Global } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIQueue } from './ai.queue';
import { RedisService } from './redis.service';
import { SettingsService } from './settings.service';
import { LocalProvider } from './providers/local.provider';
import { GroqProvider } from './providers/groq.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { TranslationQueue } from './translation.queue';
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
    OpenRouterProvider,
    TranslationQueue,
  ],
  exports: [AIQueue, AIService, SettingsService, TranslationQueue],
})
export class AIModule {}
