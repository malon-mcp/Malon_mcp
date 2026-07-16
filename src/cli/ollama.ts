import { logger } from '../util/log.js';

export interface OllamaHealthResult {
  available: boolean;
  version?: string | undefined;
  models?: string[] | undefined;
  error?: string | undefined;
  url: string;
}

export async function checkOllamaHealth(
  baseUrl?: string,
  timeoutMs = 5_000,
): Promise<OllamaHealthResult> {
  const url = baseUrl ?? process.env['OLLAMA_URL'] ?? 'http://127.0.0.1:11434';
  const result: OllamaHealthResult = { available: false, url };

  try {
    const listResp = await fetch(`${url}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!listResp.ok) {
      result.error = `Ollama responded with status ${listResp.status}`;
      return result;
    }

    const data = (await listResp.json()) as { models?: { name: string }[] };
    result.available = true;
    result.models = (data.models ?? []).map((m) => m.name);

    const versionResp = await fetch(`${url}/api/version`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (versionResp.ok) {
      const v = (await versionResp.json()) as { version?: string };
      result.version = v.version;
    }

    logger.info(
      { version: result.version, modelCount: result.models?.length, url },
      'ollama_available',
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.error = msg;
    logger.debug({ error: msg, url }, 'ollama_unavailable');
  }

  return result;
}

export async function ensureModelAvailable(
  model: string,
  baseUrl?: string,
  timeoutMs = 30_000,
): Promise<{ available: boolean; pulled?: boolean; error?: string }> {
  const health = await checkOllamaHealth(baseUrl, 5_000);
  if (!health.available) {
    return { available: false, error: health.error ?? 'Ollama not reachable' };
  }

  if (health.models?.includes(model)) {
    return { available: true };
  }

  const url = baseUrl ?? process.env['OLLAMA_URL'] ?? 'http://127.0.0.1:11434';
  logger.info({ model, url }, 'ollama_pulling_model');

  try {
    const pullResp = await fetch(`${url}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: false }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!pullResp.ok) {
      const text = await pullResp.text();
      return { available: false, error: `Pull failed: ${pullResp.status} ${text}` };
    }

    logger.info({ model }, 'ollama_model_pulled');
    return { available: true, pulled: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { available: false, error: msg };
  }
}

export const RECOMMENDED_LOCAL_MODELS = [
  { id: 'llama3.1-8b', description: 'Llama 3.1 8B (default, good balance)', minRam: 8 },
  { id: 'llama3.1-70b', description: 'Llama 3.1 70B (best quality, needs 48GB+)', minRam: 48 },
  { id: 'mistral-7b', description: 'Mistral 7B (fast, efficient)', minRam: 8 },
  { id: 'codellama:7b', description: 'CodeLlama 7B (code-focused)', minRam: 8 },
  { id: 'qwen2.5-coder:7b', description: 'Qwen 2.5 Coder 7B (code-focused)', minRam: 8 },
  { id: 'deepseek-coder:6.7b', description: 'DeepSeek Coder 6.7B', minRam: 8 },
  { id: 'phi3:14b', description: 'Phi-3 Medium 14B (quality/memory sweet spot)', minRam: 16 },
];

export function generateLocalConfig(model: string): string {
  return `# Malon configuration — local-only mode (auto-configured)
local:
  enabled: true
  model: ${model}
  ollama_url: http://127.0.0.1:11434

pricing:
  last_verified: '${new Date().toISOString().slice(0, 10)}'
  providers:
    ollama:
      ${model}:
        input_per_million: 0
        output_per_million: 0

search:
  provider: ollama
  model: ${model}
  subagent_timeout_ms: 15000
  max_rounds: 4
  max_output_bytes: 32768

cost:
  ceiling_usd: 0
  shadow:
    tokens_per_file_read: 4000
    avg_tokens_per_file: 350

rate_limits:
  max_calls_per_session: 100
  max_tokens_per_session: 500000
  window_ms: 60000

log:
  level: info
  file: ''

telemetry:
  enabled: false
`;
}
