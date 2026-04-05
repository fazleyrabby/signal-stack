import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { logEvent } from '../../common/logger';

@Injectable()
export class GroqProvider {
  private readonly apiKey: string | undefined;
  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly model = 'llama-3.3-70b-versatile';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GROQ_API_KEY');
  }

  async summarize(title: string, content: string): Promise<string | null> {
    if (!this.apiKey) {
      logEvent('warn', 'groq_provider_missing_key', {});
      return null;
    }

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'Summarize why this matters in one sentence. max 30 words, no fluff, no repetition, plain English.',
            },
            {
              role: 'user',
              content: `Title: ${title}\n\nContent: ${content}`,
            },
          ],
          temperature: 0.1,
          max_tokens: 150,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );

      const result = response.data?.choices?.[0]?.message?.content?.trim();
      return result ? this.cleanResponse(result) : null;
    } catch (error: any) {
      logEvent('warn', 'groq_provider_error', { 
        status: error.response?.status, 
        message: error.message 
      });
      return null;
    }
  }

  private cleanResponse(text: string): string {
    return text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  }
}
