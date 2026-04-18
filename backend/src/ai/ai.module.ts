import { Module, Global } from '@nestjs/common';
import { AIService } from './ai.service';
import { PicoClawService } from './picoclaw.service';
import { AIQueue } from './ai.queue';
import { RedisService } from './redis.service';
import { SettingsService } from './settings.service';
import { LocalProvider } from './providers/local.provider';
import { MacLocalProvider } from './providers/mac-local.provider';
import { GroqProvider } from './providers/groq.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { TranslationQueue } from './translation.queue';
import { MetricsService } from './metrics.service';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    AIService,
    PicoClawService,
    AIQueue,
    RedisService,
    SettingsService,
    LocalProvider,
    MacLocalProvider,
    GroqProvider,
    OpenRouterProvider,
    TranslationQueue,
    MetricsService,
  ],
  exports: [AIQueue, AIService, SettingsService, TranslationQueue, MetricsService, RedisService, GroqProvider, OpenRouterProvider, PicoClawService, MacLocalProvider],
})
export class AIModule {}
