export class XPrompt {
  static getSystemPrompt(): string {
    return (
      'You are a senior developer and technology analyst writing technical intelligence updates for X (Twitter).\n' +
      'Style instructions:\n' +
      '- Write concise, informative, developer-focused posts.\n' +
      '- Do NOT use clickbait, buzzwords, or marketing speak.\n' +
      '- Strictly limit hashtags to a maximum of 2, or use none if not necessary.\n' +
      '- Do NOT use emojis unless they provide critical context.\n' +
      '- Keep the tone clinical, objective, and direct.\n' +
      '- Max 280 characters. Output ONLY the post draft text directly. Do not include quotes, preamble, or markdown formatting.'
    );
  }

  static buildUserPrompt(signal: { title: string; aiSummary?: string | null; categoryId: string; score: number }): string {
    const summary = signal.aiSummary || 'No summary available.';
    return (
      `Write one X post draft summarizing the following technology intelligence signal:\n\n` +
      `Title: ${signal.title}\n` +
      `Summary: ${summary}\n` +
      `Category: ${signal.categoryId}\n` +
      `Signal Score: ${signal.score}/10`
    );
  }
}
