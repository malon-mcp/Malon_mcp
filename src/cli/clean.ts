import {
  pruneUsageLog,
  purgeUsageLog,
  purgeIndex,
  getUsageLogStats,
} from '../governor/retention.js';

const USAGE = `malon clean <subcommand>

Subcommands:
  usage         Prune old records from usage.log (based on retention config)
  purge-logs    Delete all usage.log records (irreversible)
  purge-index   Delete index.db (requires re-index)
  purge-all     Delete both usage.log and index.db (irreversible)
  stats         Show current usage.log statistics
  help          Show this help message
`;

export async function cleanCommand(repoRoot: string, args: string[]): Promise<void> {
  const subcommand = args[0] ?? 'help';

  switch (subcommand) {
    case 'usage': {
      const result = await pruneUsageLog(repoRoot);
      process.stdout.write(
        JSON.stringify({ deleted: result.deleted, kept: result.kept }, null, 2) + '\n',
      );
      break;
    }

    case 'purge-logs': {
      if (!args.includes('--force')) {
        process.stderr.write(
          'This will permanently delete all usage log data. Use --force to confirm.\n',
        );
        process.exit(1);
      }
      await purgeUsageLog(repoRoot);
      process.stdout.write(JSON.stringify({ purged: 'usage.log' }, null, 2) + '\n');
      break;
    }

    case 'purge-index': {
      if (!args.includes('--force')) {
        process.stderr.write('This will delete the search index. Use --force to confirm.\n');
        process.exit(1);
      }
      await purgeIndex(repoRoot);
      process.stdout.write(JSON.stringify({ purged: 'index.db' }, null, 2) + '\n');
      break;
    }

    case 'purge-all': {
      if (!args.includes('--force')) {
        process.stderr.write(
          'This will permanently delete all usage data and the search index. Use --force to confirm.\n',
        );
        process.exit(1);
      }
      const result = await purgeAllData(repoRoot);
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      break;
    }

    case 'stats': {
      const stats = await getUsageLogStats(repoRoot);
      process.stdout.write(JSON.stringify(stats, null, 2) + '\n');
      break;
    }

    case 'help':
    case undefined:
    case '--help':
    case '-h':
      process.stdout.write(USAGE);
      break;

    default:
      process.stderr.write(`Unknown clean subcommand: ${subcommand}\n${USAGE}`);
      process.exit(1);
  }
}

async function purgeAllData(repoRoot: string): Promise<{ usage_log: boolean; index_db: boolean }> {
  await purgeUsageLog(repoRoot);
  await purgeIndex(repoRoot);
  return { usage_log: true, index_db: true };
}
