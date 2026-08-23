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
      .filter(
        (m: any) =>
          m.active !== false &&
          !m.id.includes('whisper') &&
          !m.id.includes('guard') &&
          !m.id.includes('safeguard') &&
          !m.id.includes('orpheus') &&
          (m.output_modalities?.includes('text') || !m.output_modalities) &&
          ((m.context_window && m.context_window >= 2048) ||
            (m.context_length && m.context_length >= 2048)),
      )
      .map((m: any) => ({
        id: m.id,
        name: m.name || m.id.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        provider: 'groq' as LLMProvider,
        contextLength: m.context_window || m.context_length || 131072,
        isFree: true,
      }));
  } catch {
    return [];
  }
}

export async function fetchOpenRouterModels(
  apiKey: string,
): Promise<LLModel[]> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || [])
      .filter(
        (m: any) =>
          m.pricing?.['prompt'] === '0' ||
          parseFloat(m.pricing?.['prompt'] || '1') === 0,
      )
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
    {
      id: 'openai/gpt-oss-120b',
      name: 'GPT OSS 120B',
      provider: 'groq',
      contextLength: 131072,
      isFree: true,
    },
    {
      id: 'openai/gpt-oss-20b',
      name: 'GPT OSS 20B',
      provider: 'groq',
      contextLength: 131072,
      isFree: true,
    },
    {
      id: 'qwen/qwen3.6-27b',
      name: 'Qwen 3.6 27B',
      provider: 'groq',
      contextLength: 131072,
      isFree: true,
    },
    {
      id: 'groq/compound',
      name: 'Compound',
      provider: 'groq',
      contextLength: 131072,
      isFree: true,
    },
    {
      id: 'groq/compound-mini',
      name: 'Compound Mini',
      provider: 'groq',
      contextLength: 131072,
      isFree: true,
    },
    {
      id: 'allam-2-7b',
      name: 'ALLaM 2 7B',
      provider: 'groq',
      contextLength: 4096,
      isFree: true,
    },
  ],
  openrouter: [
    {
      id: 'meta-llama/llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B',
      provider: 'openrouter',
      contextLength: 128000,
      isFree: true,
    },
    {
      id: 'meta-llama/llama-3.1-405b-instruct',
      name: 'Llama 3.1 405B',
      provider: 'openrouter',
      contextLength: 128000,
      isFree: true,
    },
    {
      id: 'meta-llama/llama-3.1-70b-instruct',
      name: 'Llama 3.1 70B',
      provider: 'openrouter',
      contextLength: 128000,
      isFree: true,
    },
    {
      id: 'meta-llama/llama-3.1-8b-instruct',
      name: 'Llama 3.1 8B',
      provider: 'openrouter',
      contextLength: 128000,
      isFree: true,
    },
    {
      id: 'qwen/qwen2.5-72b-instruct',
      name: 'Qwen 2.5 72B',
      provider: 'openrouter',
      contextLength: 32768,
      isFree: true,
    },
  ],
};
