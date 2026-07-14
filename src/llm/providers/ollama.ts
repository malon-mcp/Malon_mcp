import type { LlmCallOptions, LlmResponse } from '../client.js';

export async function callOllama(opts: LlmCallOptions): Promise<LlmResponse> {
  const baseUrl = process.env['OLLAMA_URL'] ?? 'http://127.0.0.1:11434';

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    body: JSON.stringify({
      model: opts.model ?? 'llama3.1-8b',
      messages: [
        { role: 'system', content: opts.systemPrompt },
        ...opts.messages,
      ],
      options: { num_predict: opts.maxTokens ?? 1024 },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    message: { content: string };
    eval_count?: number;
  };

  return {
    content: data.message?.content ?? '',
    inputTokens: 0,
    outputTokens: data.eval_count ?? 0,
  };
}
