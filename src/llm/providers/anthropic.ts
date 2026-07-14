import type { LlmCallOptions, LlmResponse } from '../client.js';

export async function callAnthropic(opts: LlmCallOptions): Promise<LlmResponse> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 8_000),
    body: JSON.stringify({
      model: opts.model ?? 'claude-haiku-4-5',
      system: opts.systemPrompt,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 1024,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  return {
    content: data.content.map((c) => c.text).join('\n'),
    inputTokens: data.usage.input_tokens,
    outputTokens: data.usage.output_tokens,
  };
}
