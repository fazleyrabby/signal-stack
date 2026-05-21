import { PlatformFormatter } from './base.formatter';
import { CanonicalIntelligenceAsset } from '../types/canonical';

export class XFormatter extends PlatformFormatter {
  readonly platform = 'x';
  readonly charLimit = 280;

  format(asset: CanonicalIntelligenceAsset) {
    const tags = asset.tags
      ?.slice(0, 2)
      .map(t => `#${t.replace(/\s+/g, '')}`)
      .join(' ') ?? '';

    // Try: summary + tags
    const withTags = tags ? `${asset.executiveSummary}\n\n${tags}` : asset.executiveSummary;
    if (withTags.length <= this.charLimit) return this.post(withTags);

    // Summary alone
    const summaryOnly = asset.executiveSummary;
    if (summaryOnly.length <= this.charLimit) return this.post(summaryOnly);

    // Truncate
    return this.post(this.truncate(summaryOnly, this.charLimit));
  }
}
