import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

process.env.ANTHROPIC_API_KEY = 'test-key';

import { classifyWithAI } from '../services/classification/aiClassifier';

describe('AI Classifier', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('returns classification from valid AI response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"docClass": "paystub", "confidence": 0.92, "reasoning": "Contains pay period and gross pay"}' }],
    });

    const result = await classifyWithAI('Pay Statement\nGross Pay: $3,000');
    expect(result.docClass).toBe('paystub');
    expect(result.confidence).toBe(0.92);
    expect(result.method).toBe('ai');
  });

  it('handles markdown-wrapped JSON response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '```json\n{"docClass": "w2", "confidence": 0.95}\n```' }],
    });

    const result = await classifyWithAI('Wage and Tax Statement');
    expect(result.docClass).toBe('w2');
    expect(result.confidence).toBe(0.95);
  });

  it('returns unclassified when AI response has no JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'I am not sure what this document is.' }],
    });

    const result = await classifyWithAI('random content');
    expect(result.docClass).toBe('unclassified');
    expect(result.confidence).toBe(0);
  });

  it('returns unclassified for invalid JSON structure', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"type": "paystub", "score": 0.9}' }],
    });

    const result = await classifyWithAI('some content');
    expect(result.docClass).toBe('unclassified');
  });
});
