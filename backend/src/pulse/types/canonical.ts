export type CanonicalIntelligenceAsset = {
  title: string;
  executiveSummary: string;         // 1–2 sentences, dense, technical
  technicalBreakdown?: string;      // what changed / how it works
  whyItMatters?: string;            // implications for devs / industry
  keyPoints?: string[];             // 2–4 bullets, concise
  sourceUrl?: string;
  tags?: string[];                  // 2–3 technical tags
  category?: string;
  score?: number;
};
