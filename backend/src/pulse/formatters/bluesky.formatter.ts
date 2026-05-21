import { PlatformFormatter } from './base.formatter';
import { CanonicalIntelligenceAsset } from '../types/canonical';

export class BlueskyFormatter extends PlatformFormatter {
  readonly platform = 'bluesky';
  readonly charLimit = 300;

  format(asset: CanonicalIntelligenceAsset) {
    // Bluesky: developer-focused, concise technical commentary
    const summary = asset.executiveSummary;
    if (summary.length <= this.charLimit) return this.post(summary);
    return this.post(this.truncate(summary, this.charLimit));
  }
}
