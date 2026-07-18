#!/usr/bin/env node
import { logger, setLogLevel } from '../util/log.js';
import { initCommand } from './init.js';
import { statusCommand } from './status.js';
import { resetCommand } from './reset.js';
import { indexCommand } from './index-cmd.js';
import { cleanCommand } from './clean.js';
import { checkOllamaHealth, RECOMMENDED_LOCAL_MODELS } from './ollama.js';

const USAGE = `Usage: malon <command>

Commands:
  init              Initialize .malon/ directory structure, config, and index
  init --local      Initialize in local-only mode (auto-detect Ollama)
  init --incremental  Incremental re-index (uses git diff since last indexed sha)
  index             Full re-index of the repository
  status            Show current session status, spend, and rot flags
  local-check       Test and report local LLM (Ollama) availability
  clean             Data retention and cleanup operations (use 'malon clean help' for details)
  reset             Delete index.db, usage.log, and lock file
  help              Show this help message
`;

async function main(): Promise<void> {
  if (process.env['MALON_DEBUG']) {
    setLogLevel('debug');
  }

  const command = process.argv[2];

  switch (command) {
    case 'init': {
      const repoRoot = process.cwd();
      const incremental = process.argv.includes('--incremental');
      const local = process.argv.includes('--local');
      const modelIdx = process.argv.indexOf('--model');
      const model =
        modelIdx >= 0 && modelIdx + 1 < process.argv.length
          ? process.argv[modelIdx + 1]
          : undefined;
      await initCommand(repoRoot, { incremental, local, model });
      break;
    }

    case 'index': {
      const repoRoot = process.cwd();
      await indexCommand(repoRoot);
      break;
    }

    case 'status': {
      const repoRoot = process.cwd();
      const stats = await statusCommand(repoRoot);
      logger.info({}, 'status_output');
      process.stdout.write(JSON.stringify(stats, null, 2) + '\n');
      break;
    }

    case 'local-check': {
      const result = await checkOllamaHealth();
      if (result.available) {
        process.stdout.write(`Ollama: AVAILABLE\n`);
        process.stdout.write(`Version: ${result.version ?? 'unknown'}\n`);
        process.stdout.write(`URL: ${result.url}\n`);
        process.stdout.write(`Models: ${(result.models ?? []).join(', ') || '(none pulled)'}\n`);
        process.stdout.write(`\nRecommended models for local-only mode:\n`);
        for (const m of RECOMMENDED_LOCAL_MODELS) {
          const pulled = result.models?.includes(m.id) ? '✓' : ' ';
          process.stdout.write(`  [${pulled}] ${m.id} — ${m.description}\n`);
        }
        process.stdout.write(
          `\nTry: malon init --local --model <model-id>  to configure local-only mode\n`,
        );
      } else {
        process.stderr.write(`Ollama: UNAVAILABLE\n`);
        process.stderr.write(`URL: ${result.url}\n`);
        process.stderr.write(`Error: ${result.error ?? 'Connection refused'}\n`);
        process.stderr.write(`\nTo use local-only mode:\n`);
        process.stderr.write(`  1. Install Ollama from https://ollama.ai\n`);
        process.stderr.write(
          `  2. Run: ollama pull llama3.1-8b (or another model from the recommended list)\n`,
        );
        process.stderr.write(`  3. Verify with: malon local-check\n`);
        process.stderr.write(`  4. Run: malon init --local\n`);
        process.exit(1);
      }
      break;
    }

    case 'reset': {
      const repoRoot = process.cwd();
      await resetCommand(repoRoot);
      break;
    }

    case 'clean': {
      const repoRoot = process.cwd();
      await cleanCommand(repoRoot, process.argv.slice(3));
      break;
    }

    case 'help':
    case undefined:
    case '--help':
    case '-h':
      process.stdout.write(USAGE);
      break;

    default:
      process.stderr.write(`Unknown command: ${command}\n${USAGE}`);
      process.exit(1);
  }
}

main().catch((err) => {
  logger.error({ err }, 'cli_crash');
  process.exit(1);
});
