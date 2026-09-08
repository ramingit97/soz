import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isKnownModel, llmCost, sttCost, ttsCost } from './cost.js';

describe('llmCost', () => {
  it('prices gpt-4o-mini at $0.15 / $0.60 per 1M', () => {
    const usd = llmCost('gpt-4o-mini', { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    assert.equal(+usd.toFixed(4), 0.75);
  });

  it('charges cached input at the cached rate', () => {
    const full = llmCost('gpt-5.6-terra', { inputTokens: 1_000_000, outputTokens: 0 });
    const cached = llmCost('gpt-5.6-terra', {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cachedTokens: 1_000_000,
    });
    assert.equal(+full.toFixed(2), 2.0);
    assert.equal(+cached.toFixed(2), 0.2);
  });

  it('never counts more cached tokens than input tokens', () => {
    const usd = llmCost('gpt-5.6-terra', {
      inputTokens: 100,
      outputTokens: 0,
      cachedTokens: 10_000,
    });
    assert.equal(+usd.toFixed(6), +((100 / 1e6) * 0.2).toFixed(6));
  });

  it('over-counts, never under-counts, an unknown model', () => {
    // A typo in OPENAI_CHAT_MODEL should make the bill look worse, not better.
    const unknown = llmCost('gpt-9-ultra', { inputTokens: 1000, outputTokens: 1000 });
    const terra = llmCost('gpt-5.6-terra', { inputTokens: 1000, outputTokens: 1000 });
    assert.ok(unknown > terra);
    assert.equal(isKnownModel('gpt-9-ultra'), false);
  });
});

describe('stt / tts', () => {
  it('prices a minute of Deepgram Nova-3 at $0.0043', () => {
    assert.equal(+sttCost(60_000).toFixed(4), 0.0043);
  });

  it('prices ElevenLabs at $0.05 per 1k characters and OpenAI tts-1 at $0.015', () => {
    assert.equal(+ttsCost(1000).toFixed(3), 0.05);
    assert.equal(+ttsCost(1000, 'openai').toFixed(3), 0.015);
  });
});
