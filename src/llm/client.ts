export interface LlmCallOptions {
  provider: string;
  model: string;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface LlmResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export async function callLlm(opts: LlmCallOptions): Promise<LlmResponse> {
  switch (opts.provider) {
    case 'anthropic': {
      const { callAnthropic } = await import('./providers/anthropic.js');
      return callAnthropic(opts);
    }
    case 'openai': {
      const { callOpenAi } = await import('./providers/openai.js');
      return callOpenAi(opts);
    }
    case 'ollama': {
      const { callOllama } = await import('./providers/ollama.js');
      return callOllama(opts);
    }
    default:
      throw new Error(`Unknown LLM provider: ${opts.provider}`);
  }
}
