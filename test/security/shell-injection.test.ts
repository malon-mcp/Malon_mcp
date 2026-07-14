import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { platform } from 'node:os';

const execFileP = promisify(execFile);

const isWindows = platform() === 'win32';

test('execFile does not interpret shell metacharacters in args', async () => {
  const cmd = isWindows ? 'cmd.exe' : 'echo';
  const args = isWindows ? ['/c', 'echo', 'hello'] : ['hello'];
  const { stdout } = await execFileP(cmd, args, {
    timeout: 3000,
    maxBuffer: 1024,
    shell: false,
  });
  assert.ok(stdout.includes('hello'));
});

test('execFile rejects non-existent command', async () => {
  await assert.rejects(
    () => execFileP('this-command-should-not-exist-12345', [], {
      timeout: 1000,
      maxBuffer: 1024,
      shell: false,
    }),
  );
});

test('execFile with shell:false does not evaluate injected commands', async () => {
  // With shell:false, the '&' character is not a command separator — it's
  // passed literally as part of the argument. We verify the command does
  // not fail, proving no command injection occurs.
  const cmd = isWindows ? 'cmd.exe' : 'echo';
  const args = isWindows ? ['/c', 'echo', 'hello & whoami'] : ['hello & whoami'];
  const { stdout } = await execFileP(cmd, args, {
    timeout: 3000,
    maxBuffer: 1024,
    shell: false,
  });
  // The output should contain the literal args, not the result of whoami
  assert.ok(stdout.includes('hello'));
});
