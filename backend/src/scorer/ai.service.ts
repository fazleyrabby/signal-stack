import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { logEvent } from '../common/logger';

export interface AIAnalysisResult {
  summary: string;
  score: number;
  aiCategory: string;
}

interface AIProvider {
  name: string;
  url: string;
  key: string | undefined;
  model: string;
}

@Injectable()
export class AIService {
  private providers: AIProvider[];

  constructor(private configService: ConfigService) {
    this.providers = [
      {
        name: 'Groq',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: this.configService.get<string>('GROQ_API_KEY'),
        model: 'llama-3.3-70b-versatile',
      },
      {
        name: 'OpenRouter',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        key: this.configService.get<string>('OPENROUTER_API_KEY'),
        model: 'meta-llama/llama-3.1-405b-instruct',
      },
    ];
  }

  async analyzeSignal(title: string, content: string): Promise<AIAnalysisResult | null> {
    const isAiEnabled = this.configService.get<string>('AI_ENABLED') !== 'false';
    if (!isAiEnabled) {
      logEvent('info', 'ai_intelligence_disabled', { reason: 'manual_override' });
      return null;
    }

    for (const provider of this.providers) {
      if (!provider.key) {
        continue;
      }

      try {
        const result = await this.executeProvider(provider, title, content);
        if (result) {
          logEvent('info', 'ai_provider_success', { provider: provider.name, title: title.slice(0, 50) });
          return result;
        }
      } catch (error: any) {
        const isRateLimit = error.response?.status === 429;
        logEvent('warn', isRateLimit ? 'ai_provider_rate_limit' : 'ai_provider_error', {
          provider: provider.name,
          error: error.message,
        });

        // Failover to next provider
        continue;
      }
    }

    // Both failed - silent keyword fallback in ScorerService
    return null;
  }

  private async executeProvider(provider: AIProvider, title: string, content: string): Promise<AIAnalysisResult | null> {
    const response = await axios.post(
      provider.url,
      {
        model: provider.model,
        messages: [
          {
            role: 'system',
            content: `You are an intelligence researcher for SignalStack. 
            Analyze the news signal for geopolitical/tech significance.
            Response ONLY in JSON:
            {
              "summary": "1-sentence executive summary",
              "score": 1-10 (1=noise, 5=relevant, 10=critical),
              "aiCategory": "Outage|Cyber|Geopolitics|Finance|Tech|Policy"
            }`,
          },
          {
            role: 'user',
            content: `Title: ${title}\nContent: ${content}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 250,
      },
      {
        headers: {
          Authorization: `Bearer ${provider.key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://signalstack.now',
          'X-Title': 'SignalStack',
        },
        timeout: 10000,
      }
    );

    const data = response.data;
    const contentText = data.choices[0].message.content;
    const result = JSON.parse(contentText);

    return {
      summary: result.summary,
      score: Number(result.score) || 1,
      aiCategory: result.aiCategory,
    };
  }
}
