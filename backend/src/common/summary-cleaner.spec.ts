import { cleanSummaryText, isLowQualitySummary } from './summary-cleaner';

describe('summary-cleaner', () => {
  describe('cleanSummaryText', () => {
    it('should strip closed <think>...</think> blocks', () => {
      const input = `<think>
Here's a thinking process:
1. Analyze user input
2. Draft summary
</think>
This is the actual summary of the news article.`;

      const result = cleanSummaryText(input);
      expect(result).toBe('This is the actual summary of the news article.');
    });

    it('should strip unclosed <think> blocks when truncated', () => {
      const input = `<think> Here's a thinking process: 1. **Analyze User Input:** - **Title:** Trump waves green flag kicking off high-speed IndyCar race`;
      const result = cleanSummaryText(input);
      expect(result).toBe('');
    });

    it('should strip preambles and special tokens', () => {
      const input = `<pad><|im_start|>system\nHere's a thinking process: The team launched a new satellite into low Earth orbit.`;
      const result = cleanSummaryText(input);
      expect(result).toBe('The team launched a new satellite into low Earth orbit.');
    });

    it('should strip markdown code fences', () => {
      const input = '```\nMarkets rallied following the latest interest rate decision.\n```';
      const result = cleanSummaryText(input);
      expect(result).toBe('Markets rallied following the latest interest rate decision.');
    });

    it('should clean surrounding quotes and whitespace', () => {
      const input = '   "New environmental policies take effect across the EU next month."   ';
      const result = cleanSummaryText(input);
      expect(result).toBe('New environmental policies take effect across the EU next month.');
    });
  });

  describe('isLowQualitySummary', () => {
    it('should return true for empty or too short text', () => {
      expect(isLowQualitySummary('')).toBe(true);
      expect(isLowQualitySummary(null)).toBe(true);
      expect(isLowQualitySummary('Too short')).toBe(true);
    });

    it('should return true for thinking traces', () => {
      expect(isLowQualitySummary("<think> Here's a thinking process: 1. **Analyze User Input:**")).toBe(true);
      expect(isLowQualitySummary("Here's a thinking process: Analyzing user input title")).toBe(true);
    });

    it('should return true for refusal and boilerplate phrases', () => {
      expect(isLowQualitySummary('I am an AI assistant and I cannot provide information on this topic.')).toBe(true);
      expect(isLowQualitySummary('Please provide the content for me to summarize.')).toBe(true);
      expect(isLowQualitySummary('No content provided in the prompt.')).toBe(true);
    });

    it('should return true for raw JSON objects', () => {
      expect(isLowQualitySummary('{"choices": [{"message": {"content": "foo"}}]}')).toBe(true);
    });

    it('should return false for high quality summaries', () => {
      expect(isLowQualitySummary('Global leaders convened in Geneva to negotiate a landmark treaty on AI safety standards.')).toBe(false);
    });
  });
});
