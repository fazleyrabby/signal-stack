import { PlatformFormatter } from './base.formatter';
import { CanonicalIntelligenceAsset } from '../types/canonical';

export class FacebookFormatter extends PlatformFormatter {
  readonly platform = 'facebook';
  readonly charLimit = 63206; // FB hard limit; we enforce style targets instead
  readonly targetMin = 400;
  readonly targetMax = 1200;

  format(asset: CanonicalIntelligenceAsset) {
    const parts: string[] = [];

    // 1. Strong opening / headline
    parts.push(asset.title);
    parts.push('');

    // 2. Executive summary — the hook
    parts.push(asset.executiveSummary);

    // 3. Technical breakdown
    if (asset.technicalBreakdown) {
      parts.push('');
      parts.push(asset.technicalBreakdown);
    }

    // 4. Why it matters
    if (asset.whyItMatters) {
      parts.push('');
      parts.push(`Why this matters:\n${asset.whyItMatters}`);
    }

    // 5. Key points as bullets
    if (asset.keyPoints && asset.keyPoints.length > 0) {
      parts.push('');
      parts.push(asset.keyPoints.map(p => `• ${p}`).join('\n'));
    }

    // 6. Source attribution — always
    if (asset.sourceUrl) {
      parts.push('');
      parts.push(`Source: ${asset.sourceUrl}`);
    }

    const text = parts.join('\n');
    return this.post(text);
  }
}
