import { classifyByRules } from './ruleClassifier';
import { classifyWithAI } from './aiClassifier';
import type { ClassificationResult } from './types';

const RULE_CONFIDENCE_THRESHOLD = 0.85;
const AI_CONFIDENCE_THRESHOLD = 0.70;

/**
 * Two-tier document classification:
 * 1. Rule engine (fast, free) — if confidence >= 0.85, use immediately
 * 2. AI (Claude) — if rule engine < 0.85, fall back to AI
 *    - If AI confidence >= 0.70, use AI result
 *    - If AI confidence < 0.70, return 'unclassified'
 */
export async function classifyDocument(
  filename: string,
  textContent: string,
): Promise<ClassificationResult> {
  // Tier 1: Rule engine
  const ruleResult = classifyByRules(filename, textContent);
  if (ruleResult.confidence >= RULE_CONFIDENCE_THRESHOLD) {
    return ruleResult;
  }

  // Tier 2: AI classification
  try {
    const aiResult = await classifyWithAI(textContent);
    if (aiResult.confidence >= AI_CONFIDENCE_THRESHOLD) {
      return aiResult;
    }

    // Both tiers low confidence — return the better one or unclassified
    if (ruleResult.confidence > aiResult.confidence && ruleResult.docClass !== 'unclassified') {
      return ruleResult;
    }
    return { docClass: 'unclassified', confidence: 0, method: 'ai', reasoning: 'Both classification tiers below threshold' };
  } catch {
    // AI failed — use rule result if it has anything, otherwise unclassified
    if (ruleResult.docClass !== 'unclassified') {
      return ruleResult;
    }
    return { docClass: 'unclassified', confidence: 0, method: 'rule_engine', reasoning: 'AI classification failed' };
  }
}

export type { ClassificationResult, DocClass } from './types';
