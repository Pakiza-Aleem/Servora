import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAssistantAnswer, getGeminiClient } from '../services/aiAssistantService.js';

test('requires a configured Gemini API key', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    assert.throws(getGeminiClient, { status: 503 });
    process.env.GEMINI_API_KEY = 'your_gemini_api_key';
    assert.throws(getGeminiClient, { status: 503 });
  } finally {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test('uses the official SDK request shape and configured model', async () => {
  const originalModel = process.env.GEMINI_MODEL;
  let request;
  try {
    process.env.GEMINI_MODEL = 'gemini-test-model';
    const client = {
      interactions: {
        create: async (options) => {
          request = options;
          return { status: 'completed', output_text: 'Verified response.' };
        },
      },
    };
    assert.equal(
      await generateAssistantAnswer('Sales this week?', { currency: 'PKR' }, client),
      'Verified response.',
    );
    assert.equal(request.model, 'gemini-test-model');
    assert.match(request.input, /Sales this week/);
    assert.match(request.input, /"currency":"PKR"/);
    assert.equal(request.store, false);
    assert.equal(request.generation_config.max_output_tokens, 1200);
    assert.equal('temperature' in request.generation_config, false);
  } finally {
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
  }
});

test('uses minimal thinking for Gemini 3 models to leave room for the full answer', async () => {
  const originalModel = process.env.GEMINI_MODEL;
  try {
    process.env.GEMINI_MODEL = 'gemini-3.6-flash';
    const client = {
      interactions: {
        create: async ({ generation_config }) => {
          assert.equal(generation_config.thinking_level, 'minimal');
          return { status: 'completed', output_text: 'Complete response.' };
        },
      },
    };
    assert.equal(await generateAssistantAnswer('Question', {}, client), 'Complete response.');
  } finally {
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
  }
});

test('maps Gemini quota, configuration, and unavailable-model errors', async () => {
  const failingClient = (status) => ({
    interactions: {
      create: async () => {
        throw Object.assign(new Error('Provider request failed'), { status });
      },
    },
  });

  await assert.rejects(generateAssistantAnswer('Question', {}, failingClient(429)), { status: 429 });
  await assert.rejects(generateAssistantAnswer('Question', {}, failingClient(400)), { status: 503 });
  await assert.rejects(generateAssistantAnswer('Question', {}, failingClient(404)), { status: 503 });
  await assert.rejects(generateAssistantAnswer('Question', {}, failingClient(500)), { status: 502 });
});

test('rejects empty Gemini responses', async () => {
  const client = { interactions: { create: async () => ({ status: 'completed', output_text: '  ' }) } };
  await assert.rejects(generateAssistantAnswer('Question', {}, client), { status: 502 });
  const incompleteClient = { interactions: { create: async () => ({ status: 'incomplete', output_text: 'Partial response' }) } };
  await assert.rejects(generateAssistantAnswer('Question', {}, incompleteClient), { status: 502 });
});
