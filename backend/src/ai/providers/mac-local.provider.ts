import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { SettingsService } from '../settings.service';
import { logEvent } from '../../common/logger';

@Injectable()
export class MacLocalProvider {
  constructor(
    private readonly redisService: RedisService,
    private readonly settingsService: SettingsService,
  ) {}

  async isEnabled(): Promise<boolean> {
    const config = await this.settingsService.getModelConfig();
    return config.macLocalEnabled;
  }

  async getEndpoint(): Promise<string | null> {
    const config = await this.settingsService.getModelConfig();
    let endpoint = config.macLocalEndpoint;
    if (endpoint && !endpoint.startsWith('http')) {
      endpoint = `http://${endpoint}`;
    }
    return endpoint;
  }

  async isAvailable(): Promise<boolean> {
    if (!(await this.isEnabled())) return false;
    
    // Check Redis cache first
    const status = await this.redisService.get('mac_local:status');
    if (status) return status === 'online';

    // Perform quick health check
    const health = await this.checkHealth();
    return health.status === 'healthy';
  }

  async checkHealth(): Promise<{ status: string; latency?: number; error?: string }> {
    const endpoint = await this.getEndpoint();
    if (!endpoint) return { status: 'no_endpoint' };

    const config = await this.settingsService.getModelConfig();
    const timeout = config.macLocalTimeout || 5000;

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(`${endpoint}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const latency = Date.now() - start;
      // Cache result in Redis for 60s
      await this.redisService.set('mac_local:status', 'online', 'EX', 60);
      return { status: 'healthy', latency };
    } catch (error: any) {
      await this.redisService.set('mac_local:status', 'offline', 'EX', 60);
      return { status: 'unhealthy', error: error.message };
    }
  }

  async summarize(title: string, content: string): Promise<string | null> {
    const endpoint = await this.getEndpoint();
    if (!endpoint || !(await this.isEnabled())) return null;

    try {
      const config = await this.settingsService.getModelConfig();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.macLocalTimeout || 3000);

      const res = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mac-local',
          messages: [
            {
              role: 'system',
              content: 'Summarize why this matters in one sentence. max 30 words, no fluff, plain English.',
            },
            {
              role: 'user',
              content: `Title: ${title}\n\nContent: ${content}`,
            },
          ],
          temperature: 0.1,
          max_tokens: 150,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        await this.redisService.set('mac_local:status', 'offline', 'EX', 60);
        return null;
      }

      const data = await res.json();
      
      // Track token usage (llama.cpp returns OpenAI-compatible usage)
      const usage = data?.usage;
      if (usage) {
        await this.redisService.trackTokens(
          'mac_local',
          usage.prompt_tokens || 0,
          usage.completion_tokens || 0,
        );
      }

      return data?.choices?.[0]?.message?.content?.trim() || null;
    } catch (error: any) {
      logEvent('warn', 'mac_local_provider_error', { message: error.message });
      await this.redisService.set('mac_local:status', 'offline', 'EX', 60);
      return null;
    }
  }
}
