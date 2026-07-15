import type { LlmCallOptions, LlmResponse } from '../client.js';

export async function callOpenAi(opts: LlmCallOptions): Promise<LlmResponse> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 8_000),
    body: JSON.stringify({
      model: opts.model ?? 'gpt-4o-mini',
      messages: [{ role: 'system', content: opts.systemPrompt }, ...opts.messages],
      max_tokens: opts.maxTokens ?? 1024,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${text}`);
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
