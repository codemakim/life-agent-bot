import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// shell 문자열 대신 execFile + argv 배열을 쓴다.
// git/npm 명령에서 quoting 문제를 줄이고 /update 동작을 예측 가능하게 한다.
export async function runCommand(
  command: string,
  args: string[],
  timeoutMs = 1000 * 60 * 5
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: process.cwd(),
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 5
  });

  return { stdout, stderr };
}

export async function getGitValue(args: string[]): Promise<string> {
  return (await runCommand('git', args)).stdout.trim();
}
