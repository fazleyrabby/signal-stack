import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { settings } from '../database/schema';
import { eq } from 'drizzle-orm';

export interface ModelConfig {
  groqModel: string;
  openrouterModel: string;
}

interface CachedModels {
  groq: any[];
  openrouter: any[];
  fetchedAt: number;
}

@Injectable()
export class SettingsService {
  private modelCache: CachedModels | null = null;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB) {}

  async getSetting(key: string): Promise<string | null> {
    const result = await this.db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    return result[0]?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: new Date() },
      });
  }

  async getModelConfig(): Promise<ModelConfig> {
    const groqModel = await this.getSetting('groq_model');
    const openrouterModel = await this.getSetting('openrouter_model');

    return {
      groqModel: groqModel || 'llama-3.3-70b-versatile',
      openrouterModel: openrouterModel || 'meta-llama/llama-3.3-70b-instruct',
    };
  }

  async setModelConfig(config: Partial<ModelConfig>): Promise<void> {
    if (config.groqModel) {
      await this.setSetting('groq_model', config.groqModel);
    }
    if (config.openrouterModel) {
      await this.setSetting('openrouter_model', config.openrouterModel);
    }
  }

  async getCachedModels(): Promise<CachedModels | null> {
    if (!this.modelCache) {
      const cached = await this.getSetting('models_cache');
      if (cached) {
        try {
          this.modelCache = JSON.parse(cached);
        } catch {
          this.modelCache = null;
        }
      }
    }
    if (
      this.modelCache &&
      Date.now() - this.modelCache.fetchedAt < this.CACHE_TTL
    ) {
      return this.modelCache;
    }
    return null;
  }

  async setCachedModels(models: CachedModels): Promise<void> {
    this.modelCache = models;
    await this.setSetting('models_cache', JSON.stringify(models));
  }
}
