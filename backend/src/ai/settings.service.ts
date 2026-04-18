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

  async getModelConfig(): Promise<ModelConfig & {
    localAiEnabled: boolean;
    googlePlacesApiKey: string | null;
    mapboxApiKey: string | null;
    googlePlacesEnabled: boolean;
    mapboxEnabled: boolean;
    osmEnabled: boolean;
    translationThreshold: number;
    forceAllTranslations: boolean;
  }> {
    const groqModel = await this.getSetting('groq_model');
    const openrouterModel = await this.getSetting('openrouter_model');
    const localAiEnabled = await this.getSetting('local_ai_enabled');
    const googlePlacesApiKey = await this.getSetting('google_places_api_key');
    const mapboxApiKey = await this.getSetting('mapbox_api_key');
    const googlePlacesEnabled = await this.getSetting('google_places_enabled');
    const mapboxEnabled = await this.getSetting('mapbox_enabled');
    const osmEnabled = await this.getSetting('osm_enabled');
    const translationThreshold = await this.getSetting('translation_threshold');
    const forceAllTranslations = await this.getSetting('force_all_translations');

    return {
      groqModel: groqModel || 'llama-3.3-70b-versatile',
      openrouterModel: openrouterModel || 'meta-llama/llama-3.3-70b-instruct',
      localAiEnabled: localAiEnabled !== 'false',
      googlePlacesApiKey,
      mapboxApiKey,
      googlePlacesEnabled: googlePlacesEnabled !== 'false',
      mapboxEnabled: mapboxEnabled !== 'false',
      osmEnabled: osmEnabled !== 'false',
      translationThreshold: translationThreshold ? parseInt(translationThreshold, 10) : 7,
      forceAllTranslations: forceAllTranslations === 'true',
    };
  }

  async setModelConfig(config: Partial<ModelConfig & {
    localAiEnabled: boolean;
    googlePlacesApiKey: string | null;
    mapboxApiKey: string | null;
    googlePlacesEnabled: boolean;
    mapboxEnabled: boolean;
    osmEnabled: boolean;
    translationThreshold: number;
    forceAllTranslations: boolean;
  }>): Promise<void> {
    if (config.groqModel) {
      await this.setSetting('groq_model', config.groqModel);
    }
    if (config.openrouterModel) {
      await this.setSetting('openrouter_model', config.openrouterModel);
    }
    if (config.localAiEnabled !== undefined) {
      await this.setSetting('local_ai_enabled', String(config.localAiEnabled));
    }
    if (config.googlePlacesApiKey !== undefined) {
      await this.setSetting('google_places_api_key', config.googlePlacesApiKey || '');
    }
    if (config.mapboxApiKey !== undefined) {
      await this.setSetting('mapbox_api_key', config.mapboxApiKey || '');
    }
    if (config.googlePlacesEnabled !== undefined) {
      await this.setSetting('google_places_enabled', String(config.googlePlacesEnabled));
    }
    if (config.mapboxEnabled !== undefined) {
      await this.setSetting('mapbox_enabled', String(config.mapboxEnabled));
    }
    if (config.osmEnabled !== undefined) {
      await this.setSetting('osm_enabled', String(config.osmEnabled));
    }
    if (config.translationThreshold !== undefined) {
      await this.setSetting('translation_threshold', String(config.translationThreshold));
    }
    if (config.forceAllTranslations !== undefined) {
      await this.setSetting('force_all_translations', String(config.forceAllTranslations));
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
