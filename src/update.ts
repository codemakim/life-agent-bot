import { Bot } from 'grammy';
import { readFile, unlink } from 'node:fs/promises';
import { parseUpdateReadyNotice } from './updateNotice.js';
import { runCommand } from './shell.js';

const updateReadyPath = '.update-ready';
const defaultUpdateReadyRetryAttempts = 20;
const defaultUpdateReadyRetryIntervalMs = 30_000;

export function getSelfUpdateScriptArgs(chatId: number): string[] {
  return ['scripts/self-update.sh', String(chatId)];
}

type UpdateReadyRetryOptions = {
  maxAttempts?: number;
  intervalMs?: number;
  wait?: (ms: number) => Promise<void>;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function hasUpdateReadyNotice(): Promise<boolean> {
  try {
    await readFile(updateReadyPath, 'utf8');
    return true;
  } catch {
    return false;
  }
}

// /update는 빌드 성공 후 현재 프로세스를 종료한다.
// 이 함수는 다음 부팅 때 임시 파일을 읽고 Telegram 준비 완료 메시지를 보낸다.
export async function sendUpdateReadyNoticeIfNeeded(bot: Bot): Promise<void> {
  let text: string;

  try {
    text = await readFile(updateReadyPath, 'utf8');
  } catch {
    return;
  }

  const notice = parseUpdateReadyNotice(text);

  if (!notice) {
    await unlink(updateReadyPath).catch(() => {});
    return;
  }

  try {
    await bot.api.sendMessage(
      notice.chatId,
      [
        '업데이트 후 재시작 완료.',
        '사용 준비가 끝났습니다.',
        '',
        `Branch: ${notice.branch}`,
        `Commit: ${notice.commit}`
      ].join('\n')
    );
    await unlink(updateReadyPath).catch(() => {});
  } catch (error) {
    console.warn('Failed to send update ready notice:', error);
  }
}

export async function retryUpdateReadyNoticeUntilSent(
  bot: Bot,
  options: UpdateReadyRetryOptions = {}
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? defaultUpdateReadyRetryAttempts;
  const intervalMs = options.intervalMs ?? defaultUpdateReadyRetryIntervalMs;
  const wait = options.wait ?? delay;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await sendUpdateReadyNoticeIfNeeded(bot);

    if (!(await hasUpdateReadyNotice())) {
      return;
    }

    if (attempt < maxAttempts) {
      await wait(intervalMs);
    }
  }

  console.warn(`Update ready notice still pending after ${maxAttempts} attempts.`);
}

export async function runSelfUpdate(chatId: number): Promise<string> {
  const result = await runCommand('bash', getSelfUpdateScriptArgs(chatId));
  return result.stdout + (result.stderr ? `\nstderr:\n${result.stderr}` : '');
}
