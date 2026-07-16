import type { LlmCallOptions, LlmResponse } from '../client.js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

export async function callGemini(opts: LlmCallOptions): Promise<LlmResponse> {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const response = await fetch(GEMINI_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 8_000),
    body: JSON.stringify({
      model: opts.model ?? 'gemini-2.0-flash',
      messages: [{ role: 'system', content: opts.systemPrompt }, ...opts.messages],
      max_tokens: opts.maxTokens ?? 1024,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: data.choices[0]?.message?.content ?? '',
    inputTokens: data.usage.prompt_tokens,
    outputTokens: data.usage.completion_tokens,
  };
}
