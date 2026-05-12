import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type ConversationTurn = {
  user: string;
  assistant: string;
  createdAt: string;
};

export type ConversationMemory = {
  summary: string;
  recentTurns: ConversationTurn[];
  updatedAt?: string;
};

export type SummarizeInput = {
  previousSummary: string;
  olderTurns: ConversationTurn[];
};

export type ConversationMemoryStore = {
  get(chatId: string): Promise<ConversationMemory>;
  set(chatId: string, memory: ConversationMemory): Promise<void>;
  clear(chatId: string): Promise<void>;
};

type MemoryFile = {
  version: 1;
  chats: Record<string, ConversationMemory>;
};

export function getMemoryFilePath(dataDir: string): string {
  // 데이터 폴더 이름은 env에서 정하고, 파일명은 앱 규격으로 고정한다.
  // 그래야 나중에 같은 폴더에 다른 앱 데이터가 생겨도 충돌하지 않는다.
  return path.join(dataDir, 'life-agent-memory.json');
}

export function createEmptyConversationMemory(): ConversationMemory {
  return {
    summary: '',
    recentTurns: []
  };
}

export async function rememberTurn(
  memory: ConversationMemory,
  options: {
    user: string;
    assistant: string;
    maxRecentTurns: number;
    summarize(input: SummarizeInput): Promise<string>;
  }
): Promise<void> {
  // 최근 대화는 원문 그대로 보관한다. 모델이 직전 맥락을 정확히 이어가게 하기 위함이다.
  memory.recentTurns.push({
    user: options.user,
    assistant: options.assistant,
    createdAt: new Date().toISOString()
  });
  memory.updatedAt = new Date().toISOString();

  if (memory.recentTurns.length <= options.maxRecentTurns) {
    return;
  }

  // 최근 원문 제한을 넘은 앞쪽 대화만 요약에 흡수한다.
  // 뒤쪽 대화는 원문으로 남겨 다음 질문에 더 구체적인 맥락을 제공한다.
  const overflowCount = memory.recentTurns.length - options.maxRecentTurns;
  const olderTurns = memory.recentTurns.slice(0, overflowCount);
  memory.recentTurns = memory.recentTurns.slice(overflowCount);
  memory.summary = await options.summarize({
    previousSummary: memory.summary,
    olderTurns
  });
}

export function buildMemoryContext(memory: ConversationMemory): string {
  const parts: string[] = [];

  if (memory.summary.trim()) {
    parts.push('이전 대화 요약:', memory.summary.trim());
  }

  if (memory.recentTurns.length > 0) {
    if (parts.length > 0) {
      parts.push('');
    }

    parts.push('최근 대화 원문:');

    for (const turn of memory.recentTurns) {
      parts.push(`사용자: ${turn.user}`, `비서: ${turn.assistant}`);
    }
  }

  return parts.join('\n');
}

export function buildPromptWithMemory(prompt: string, memoryContext: string): string {
  const trimmedContext = memoryContext.trim();

  if (!trimmedContext) {
    return prompt;
  }

  // 저장된 맥락은 참고 자료일 뿐이다. 사용자가 방금 한 질문이 항상 우선이다.
  return [
    '아래는 이전 대화 맥락이다. 현재 질문에 필요한 경우에만 참고하고, 맥락과 충돌하면 현재 질문을 우선한다.',
    '',
    trimmedContext,
    '',
    '현재 질문:',
    prompt
  ].join('\n');
}

export function buildMemorySummaryPrompt(input: SummarizeInput): string {
  const previousSummary = input.previousSummary.trim() || '없음';
  const olderTurns = input.olderTurns
    .map((turn, index) =>
      [`대화 ${index + 1}`, `사용자: ${turn.user}`, `비서: ${turn.assistant}`].join('\n')
    )
    .join('\n\n');

  return [
    '기존 요약과 오래된 원문 대화를 합쳐 다음 대화에서 참고할 압축 메모리로 갱신해줘.',
    '',
    '기존 요약:',
    previousSummary,
    '',
    '추가로 압축할 오래된 대화:',
    olderTurns,
    '',
    '출력은 요약 본문만 작성해줘.'
  ].join('\n');
}

export function createFileMemoryStore(dataDir: string): ConversationMemoryStore {
  const filePath = getMemoryFilePath(dataDir);

  async function readMemoryFile(): Promise<MemoryFile> {
    try {
      const text = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(text) as Partial<MemoryFile>;

      // 깨진 파일이나 모르는 버전은 빈 메모리처럼 취급한다.
      // 봇 시작 자체가 막히는 것보다 대화 메모리만 비우는 쪽이 운영에 덜 위험하다.
      if (parsed.version !== 1 || !parsed.chats || typeof parsed.chats !== 'object') {
        return { version: 1, chats: {} };
      }

      return {
        version: 1,
        chats: parsed.chats
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return { version: 1, chats: {} };
      }

      throw error;
    }
  }

  async function writeMemoryFile(memoryFile: MemoryFile): Promise<void> {
    await mkdir(dataDir, { recursive: true });

    // 임시 파일에 먼저 쓰고 rename 해서, 쓰기 중 프로세스가 죽어도 원본 손상 가능성을 줄인다.
    const tempPath = `${filePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(memoryFile, null, 2)}\n`, 'utf8');
    await rename(tempPath, filePath);
  }

  return {
    async get(chatId) {
      const memoryFile = await readMemoryFile();
      return memoryFile.chats[chatId] ?? createEmptyConversationMemory();
    },

    async set(chatId, memory) {
      const memoryFile = await readMemoryFile();
      memoryFile.chats[chatId] = memory;
      await writeMemoryFile(memoryFile);
    },

    async clear(chatId) {
      const memoryFile = await readMemoryFile();
      delete memoryFile.chats[chatId];
      await writeMemoryFile(memoryFile);
    }
  };
}
