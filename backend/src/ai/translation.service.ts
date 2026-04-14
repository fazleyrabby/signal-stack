import { Injectable, Logger } from '@nestjs/common';
import { AIService } from './ai.service';

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(private readonly aiService: AIService) {}

  async translateSignal(title: string, summary: string, targetLang: string) {
    if (targetLang === 'en') return { title, aiSummary: summary };
    
    // Minimal prompt for efficiency
    const prompt = `Translate to ${targetLang}. Return JSON: {"title": "...", "aiSummary": "..."}\n\nTitle: ${title}\nSummary: ${summary}`;
    
    try {
       const response = await this.aiService.getCustomResponse(prompt);
       return JSON.parse(response) as { title: string; aiSummary: string };
    } catch (e) {
       this.logger.error(`Translation failed: ${e.message}`);
       return null;
    }
  }
}
