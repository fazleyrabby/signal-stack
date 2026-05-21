export class CanonicalPrompt {
  static getSystemPrompt(): string {
    return (
      'You are a senior technical intelligence analyst. ' +
      'Given a technology or AI signal, produce a structured intelligence asset as valid JSON. ' +
      'Output ONLY the raw JSON object — no markdown fences, no preamble, no explanation.\n\n' +
      'Priorities:\n' +
      '- Technical clarity over accessibility\n' +
      '- Concrete implications over vague commentary\n' +
      '- Ecosystem and operational impact\n' +
      '- Source attribution always included\n\n' +
      'Strictly avoid:\n' +
      '- Clickbait or hype framing\n' +
      '- Generic AI summaries\n' +
      '- Emoji usage\n' +
      '- Marketing language\n' +
      '- "Top X" style content\n' +
      '- Shallow one-liners'
    );
  }

  static buildUserPrompt(signal: {
    title: string;
    aiSummary?: string | null;
    categoryId: string;
    score: number;
    sourceUrl?: string | null;
  }): string {
    return (
      `Generate a CanonicalIntelligenceAsset for this signal:\n\n` +
      `Title: ${signal.title}\n` +
      `Summary: ${signal.aiSummary || 'Not available.'}\n` +
      `Category: ${signal.categoryId}\n` +
      `Signal Score: ${signal.score}/10\n` +
      (signal.sourceUrl ? `Source URL: ${signal.sourceUrl}\n` : '') +
      `\nOutput a JSON object with these fields:\n` +
      `{\n` +
      `  "title": "concise factual headline (not clickbait)",\n` +
      `  "executiveSummary": "1-2 dense technical sentences covering what happened and the core implication",\n` +
      `  "technicalBreakdown": "1-2 sentences on technical mechanism, architecture change, or implementation detail (optional)",\n` +
      `  "whyItMatters": "1-2 sentences on developer/industry/operational implications (optional)",\n` +
      `  "keyPoints": ["2-4 concise bullet point strings, no fluff"],\n` +
      `  "sourceUrl": "${signal.sourceUrl || ''}",\n` +
      `  "tags": ["2-3 precise technical tags, lowercase, no spaces"]\n` +
      `}`
    );
  }
}
