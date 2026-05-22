export type CanonicalIntelligenceAsset = {
  title: string;
  executiveSummary: string;
  detailedSummary?: string;
  technicalBreakdown?: string;
  whyItMatters?: string;
  keyPoints?: string[];
  sourceUrl?: string;
  relatedLinks?: string[];
  tags?: string[];
  category?: string;
  severity?: number;
  score?: number;
};

export type PersistedAsset = CanonicalIntelligenceAsset & {
  id: string;
  signalId: string;
  aiProvider: string;
  aiModel: string;
  createdAt: Date;
};
