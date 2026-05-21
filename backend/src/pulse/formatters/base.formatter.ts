import { CanonicalIntelligenceAsset } from '../types/canonical';

export interface PlatformPost {
  text: string;
  charCount: number;
  withinLimit: boolean;
}

export abstract class PlatformFormatter {
  abstract readonly platform: string;
  abstract readonly charLimit: number;

  abstract format(asset: CanonicalIntelligenceAsset): PlatformPost;

  protected truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.slice(0, max - 1) + '…';
  }

  protected post(text: string): PlatformPost {
    return { text, charCount: text.length, withinLimit: text.length <= this.charLimit };
  }
}
