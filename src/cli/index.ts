import { logger, setLogLevel } from '../util/log.js';
import { initCommand } from './init.js';
import { statusCommand } from './status.js';
import { resetCommand } from './reset.js';
import { indexCommand } from './index-cmd.js';
import { cleanCommand } from './clean.js';

const USAGE = `Usage: malon <command>

Commands:
  init              Initialize .malon/ directory structure, config, and index
  init --incremental  Incremental re-index (uses git diff since last indexed sha)
  index             Full re-index of the repository
  status            Show current session status, spend, and rot flags
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
      await initCommand(repoRoot, { incremental });
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
