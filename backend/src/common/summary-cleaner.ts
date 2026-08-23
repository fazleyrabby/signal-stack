/**
 * Utility functions for cleaning and validating AI-generated summaries.
 * Handles removal of reasoning traces (<think>...</think>), unclosed think tags,
 * preambles, and low-quality boilerplate.
 */

export function cleanSummaryText(text: string | null | undefined): string {
  if (!text) return '';

  let cleaned = text.trim();

  // 1. Strip closed <think>...</think> reasoning blocks
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Strip unclosed <think> blocks (when model token limit cuts off inside thinking)
  cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '').trim();
  cleaned = cleaned.replace(/^[\s\S]*?<\/think>/gi, '').trim();

  // 3. Strip special tokens and chat markers (e.g. <pad>, <|im_start|>system, <|im_end|>, <s>, etc.)
  cleaned = cleaned.replace(/<\|im_start\|>(?:system|assistant|user)?\s*/gi, '').trim();
  cleaned = cleaned.replace(/<\|im_end\|>/gi, '').trim();
  cleaned = cleaned.replace(/<pad>/gi, '').replace(/<\|.*?\|>/g, '').replace(/<s(?:ub)?>/gi, '').trim();

  // 4. Strip markdown code fences if wrapped
  cleaned = cleaned.replace(/^```(?:json|text|markdown)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // 5. Strip reasoning preambles if the model didn't use tags
  // e.g. "Here's a thinking process: 1. **Analyze User Input:**..."
  cleaned = cleaned.replace(/^(?:Here's a thinking process|Thinking Process|Thought process):?\s*/i, '').trim();

  // 6. Strip repetitive "Analyze User Input / Title / Content / Task / Constraints" structured prompt echo
  if (cleaned.includes('**Analyze User Input:**') || cleaned.includes('**Task:**') || cleaned.includes('**Constraints:**')) {
    // If output is structured thinking notes, it's not a real summary
    const afterNotes = cleaned.replace(/^(?:\s*-\s*\*\*[^*]+\*\*:[^\n]*\n*)+/gi, '').trim();
    if (afterNotes && !afterNotes.includes('**')) {
      cleaned = afterNotes;
    } else {
      return '';
    }
  }

  // 7. Normalize whitespace and newlines
  cleaned = cleaned.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

  // 8. Remove quotes around the entire string if present
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

export function isLowQualitySummary(text: string | null | undefined): boolean {
  if (!text) return true;

  const cleaned = cleanSummaryText(text);
  if (cleaned.length < 15) return true;

  const rawLower = text.toLowerCase();
  const lower = cleaned.toLowerCase();

  // Check for residual thinking / reasoning artifacts in raw or cleaned text
  if (
    lower.includes('<think') ||
    lower.includes('</think>') ||
    lower.includes('thinking process') ||
    lower.includes('analyz') && (lower.includes('input') || lower.includes('user')) ||
    lower.includes('**title:**') ||
    lower.includes('**content:**') ||
    lower.includes('**task:**') ||
    lower.includes('**constraints:**') ||
    (rawLower.includes('thinking process') && (lower.includes('analyz') || lower.includes('title') || lower.includes('task') || lower.length < 30))
  ) {
    return true;
  }

  // Check if output is raw JSON
  if ((cleaned.startsWith('{') && cleaned.endsWith('}')) || (cleaned.startsWith('[') && cleaned.endsWith(']'))) {
    return true;
  }
  if (cleaned.includes('"choices":') || cleaned.includes('"message":') || cleaned.includes('"content":')) {
    return true;
  }

  // Common refusal/failure phrases
  const failurePhrases = [
    'provide the content',
    'no content provided',
    "don't see any content",
    'i am an ai',
    'helpful assistant',
    'as an ai language model',
    "can't provide information",
    'cannot provide information',
    'do not participate',
    'political issues',
    'sensitive nature',
    'inappropriate content',
    'against safety policy',
  ];

  return failurePhrases.some((phrase) => lower.includes(phrase));
}
