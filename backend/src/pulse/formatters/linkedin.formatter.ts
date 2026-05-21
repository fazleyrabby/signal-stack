import { PlatformFormatter } from './base.formatter';
import { CanonicalIntelligenceAsset } from '../types/canonical';

export class LinkedInFormatter extends PlatformFormatter {
  readonly platform = 'linkedin';
  readonly charLimit = 3000;

  format(asset: CanonicalIntelligenceAsset) {
    const parts: string[] = [];

    parts.push(asset.title);
    parts.push('');
    parts.push(asset.executiveSummary);

    if (asset.technicalBreakdown) {
      parts.push('');
      parts.push(asset.technicalBreakdown);
    }

    if (asset.whyItMatters) {
      parts.push('');
      parts.push(`Industry implications:\n${asset.whyItMatters}`);
    }

    if (asset.keyPoints && asset.keyPoints.length > 0) {
      parts.push('');
      parts.push(asset.keyPoints.map(p => `→ ${p}`).join('\n'));
    }

    if (asset.tags && asset.tags.length > 0) {
      parts.push('');
      parts.push(asset.tags.map(t => `#${t.replace(/\s+/g, '')}`).join(' '));
    }

    if (asset.sourceUrl) {
      parts.push('');
      parts.push(asset.sourceUrl);
    }

    return this.post(parts.join('\n'));
  }
}
