import { Bot } from 'grammy';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { buildUpdateReadyNotice, parseUpdateReadyNotice } from './updateNotice.js';
import { getGitValue, runCommand } from './shell.js';

const updateReadyPath = '.update-ready';

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
  await unlink(updateReadyPath).catch(() => {});

  if (!notice) {
    return;
  }

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
}

export async function runSelfUpdate(chatId: number): Promise<string> {
  // main/master를 하드코딩하지 않고 현재 체크아웃된 브랜치를 pull한다.
  // 배포 브랜치를 바꿔도 코드 수정이 필요 없게 하기 위해서다.
  const beforeBranch = await getGitValue(['branch', '--show-current']);
  await runCommand('git', ['pull', '--ff-only']);
  const install = await runCommand('npm', ['install']);
  const build = await runCommand('npm', ['run', 'build']);
  const afterBranch = await getGitValue(['branch', '--show-current']);
  const afterCommit = await getGitValue(['rev-parse', '--short', 'HEAD']);

  // 재시작된 프로세스가 같은 채팅방에 알림을 보낼 수 있을 만큼만 저장한다.
  // 이 파일은 git에서 제외되고, 읽은 뒤 삭제된다.
  await writeFile(
    updateReadyPath,
    buildUpdateReadyNotice({
      chatId,
      branch: afterBranch || beforeBranch || 'unknown',
      commit: afterCommit || 'unknown'
    }),
    'utf8'
  );

  // git/npm 출력은 길 수 있으니 마지막 일부만 보여준다.
  return [
    '업데이트 완료. 프로세스를 재시작합니다.',
    '재시작이 끝나면 이 채팅으로 준비 완료 메시지를 보냅니다.',
    '',
    `Branch: ${afterBranch || beforeBranch || 'unknown'}`,
    `Commit: ${afterCommit || 'unknown'}`,
    '',
    'npm install:',
    install.stdout.slice(-1200),
    install.stderr ? `stderr:\n${install.stderr.slice(-800)}` : '',
    '',
    'npm run build:',
    build.stdout.slice(-1200),
    build.stderr ? `stderr:\n${build.stderr.slice(-800)}` : ''
  ].join('\n');
}
