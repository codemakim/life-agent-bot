export type UpdateReadyNotice = {
  chatId: number;
  branch: string;
  commit: string;
};

const PREFIX = 'LIFE_AGENT_UPDATE_READY';

// 재시작 사이에 넘길 정보가 적으므로 단순한 line-based 포맷을 쓴다.
// 사람이 직접 열어봐도 이해하기 쉬운 형태다.
export function buildUpdateReadyNotice(notice: UpdateReadyNotice): string {
  return [
    PREFIX,
    `chatId=${notice.chatId}`,
    `branch=${notice.branch}`,
    `commit=${notice.commit}`
  ].join('\n');
}

export function parseUpdateReadyNotice(text: string): UpdateReadyNotice | undefined {
  const lines = text.trim().split('\n');

  if (lines[0] !== PREFIX) {
    return undefined;
  }

  const values = new Map<string, string>();

  for (const line of lines.slice(1)) {
    const index = line.indexOf('=');

    if (index === -1) {
      continue;
    }

    values.set(line.slice(0, index), line.slice(index + 1));
  }

  const chatId = Number(values.get('chatId'));
  const branch = values.get('branch');
  const commit = values.get('commit');

  if (!Number.isSafeInteger(chatId) || !branch || !commit) {
    return undefined;
  }

  return { chatId, branch, commit };
}
