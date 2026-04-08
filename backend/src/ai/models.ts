import { ConfigService } from '@nestjs/config';

export type LLMProvider = 'groq' | 'openrouter';

export interface LLModel {
  id: string;
  name: string;
  provider: LLMProvider;
  contextLength: number;
  isFree?: boolean;
}

export async function fetchGroqModels(apiKey: string): Promise<LLModel[]> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || [])
      .filter((m: any) => m.id.includes('llama') || m.id.includes('mixtral'))
      .map((m: any) => ({
        id: m.id,
        name: m.id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        provider: 'groq' as LLMProvider,
        contextLength: m.context_window || 128000,
        isFree: true,
      }));
  } catch {
    return [];
  }
}

export async function fetchOpenRouterModels(apiKey: string): Promise<LLModel[]> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || [])
      .filter((m: any) => (m.pricing?.['prompt'] === '0' || parseFloat(m.pricing?.['prompt'] || '1') === 0))
      .slice(0, 20)
      .map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        provider: 'openrouter' as LLMProvider,
        contextLength: m.context_length || 128000,
        isFree: true,
      }));
  } catch {
    return [];
  }
}

export const STATIC_FREE_MODELS: Record<LLMProvider, LLModel[]> = {
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', contextLength: 128000, isFree: true },
    { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', provider: 'groq', contextLength: 128000, isFree: true },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'groq', contextLength: 128000, isFree: true },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq', contextLength: 32768, isFree: true },
  ],
  openrouter: [
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'openrouter', contextLength: 128000, isFree: true },
    { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', provider: 'openrouter', contextLength: 128000, isFree: true },
    { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'openrouter', contextLength: 128000, isFree: true },
    { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', provider: 'openrouter', contextLength: 128000, isFree: true },
    { id: 'qwen/qwen2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'openrouter', contextLength: 32768, isFree: true },
  ],
};