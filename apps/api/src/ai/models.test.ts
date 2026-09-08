/**
 * The request-shape rule for GPT-5.x. Verified live on 2026-08-25:
 * `max_tokens` → 400 "Unsupported parameter … use max_completion_tokens", and
 * the default reasoning effort adds seconds of thinking before a one-line reply.
 * A model swap via env must never reintroduce either.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { completionLimits, isReasoningModel } from './models.js';

describe('completionLimits', () => {
  it('uses the legacy cap for gpt-4o family', () => {
    assert.deepEqual(completionLimits('gpt-4o-mini', 120), { max_tokens: 120 });
    assert.deepEqual(completionLimits('gpt-4o', 6000), { max_tokens: 6000 });
  });

  it('uses max_completion_tokens and no reasoning for gpt-5 family', () => {
    assert.deepEqual(completionLimits('gpt-5.6-terra', 200), {
      max_completion_tokens: 200,
      reasoning_effort: 'none',
    });
    assert.deepEqual(completionLimits('gpt-5-mini', 60), {
      max_completion_tokens: 60,
      reasoning_effort: 'none',
    });
  });

  it('treats o-series as reasoning models too', () => {
    assert.equal(isReasoningModel('o3-mini'), true);
    assert.equal(isReasoningModel('gpt-4.1-mini'), false);
  });
});
