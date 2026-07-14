import { SecretLeakSuspectedError } from '../util/errors.js';
import { logger } from '../util/log.js';

const PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'anthropic_api_key', re: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: 'openai_api_key', re: /sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}/g },
  { name: 'github_pat', re: /ghp_[A-Za-z0-9]{36,}/g },
  { name: 'aws_access_key', re: /AKIA[0-9A-Z]{16}/g },
  { name: 'private_key_block', re: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g },
  { name: 'slack_token', re: /xox[abprs]-[A-Za-z0-9-]{10,}/g },
  { name: 'jwt', re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
];

const ALLOW_LISTED_SUBSTRINGS: string[] = [];

export function scanForSecrets(content: string): void {
  for (const { name, re } of PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(content);
    if (!m) continue;
    if (ALLOW_LISTED_SUBSTRINGS.some((s) => m[0].includes(s))) {
      logger.debug({ pattern: name }, 'secret_scan_allow_listed');
      continue;
    }
    const excerpt = m[0].slice(0, 8) + '…';
    throw new SecretLeakSuspectedError(name, excerpt);
  }
}
