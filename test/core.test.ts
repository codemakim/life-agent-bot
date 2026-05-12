import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { buildImageRequest } from '../src/imageRequest.js';
import {
  buildPromptWithMemory,
  createFileMemoryStore,
  buildMemoryContext,
  createEmptyConversationMemory,
  getMemoryFilePath,
  rememberTurn
} from '../src/memory.js';
import { CODE_SYSTEM_PROMPT, DEEP_SYSTEM_PROMPT, DEFAULT_IMAGE_PROMPT } from '../src/prompts.js';
import { markdownToTelegramHtml } from '../src/telegramFormat.js';
import { registerCommands } from '../src/telegram.js';
import {
  getSelfUpdateScriptArgs,
  retryUpdateReadyNoticeUntilSent,
  sendUpdateReadyNoticeIfNeeded
} from '../src/update.js';
import { buildUpdateReadyNotice, parseUpdateReadyNotice } from '../src/updateNotice.js';
import { splitTelegramMessage } from '../src/telegramText.js';

describe('loadConfig', () => {
  it('requires a bot token', () => {
    assert.throws(
      () => loadConfig({}),
      /TELEGRAM_BOT_TOKEN is required/
    );
  });

  it('requires either an allowed user id or explicit setup mode', () => {
    assert.throws(
      () => loadConfig({ TELEGRAM_BOT_TOKEN: 'token' }),
      /ALLOWED_TELEGRAM_USER_ID is required/
    );
  });

  it('allows setup mode only when explicitly enabled', () => {
    const config = loadConfig({
      TELEGRAM_BOT_TOKEN: 'token',
      ALLOW_ALL_USERS_DURING_SETUP: 'true'
    });

    assert.equal(config.allowAllUsersDuringSetup, true);
    assert.deepEqual(config.allowedTelegramUserIds, []);
  });

  it('parses multiple allowed user ids from a comma-separated list', () => {
    const config = loadConfig({
      TELEGRAM_BOT_TOKEN: 'token',
      ALLOWED_TELEGRAM_USER_ID: '123, 456,789'
    });

    assert.deepEqual(config.allowedTelegramUserIds, ['123', '456', '789']);
  });

  it('uses model defaults', () => {
    const config = loadConfig({
      TELEGRAM_BOT_TOKEN: 'token',
      ALLOWED_TELEGRAM_USER_ID: '123'
    });

    assert.equal(config.fastModel, 'gemma4:e4b');
    assert.equal(config.deepModel, 'gemma4:26b');
    assert.equal(config.codeModel, 'gemma4:26b');
    assert.equal(config.visionModel, 'gemma4:e4b');
  });

  it('allows a dedicated vision model override', () => {
    const config = loadConfig({
      TELEGRAM_BOT_TOKEN: 'token',
      ALLOWED_TELEGRAM_USER_ID: '123',
      VISION_MODEL: 'gemma4:26b'
    });

    assert.equal(config.visionModel, 'gemma4:26b');
  });

  it('leaves file memory disabled unless a data directory is configured', () => {
    const config = loadConfig({
      TELEGRAM_BOT_TOKEN: 'token',
      ALLOWED_TELEGRAM_USER_ID: '123'
    });

    assert.equal(config.memoryDataDir, undefined);
  });

  it('reads the memory data directory from env', () => {
    const config = loadConfig({
      TELEGRAM_BOT_TOKEN: 'token',
      ALLOWED_TELEGRAM_USER_ID: '123',
      MEMORY_DATA_DIR: '/tmp/life-agent-data'
    });

    assert.equal(config.memoryDataDir, '/tmp/life-agent-data');
  });

  it('reads the recent memory turn limit from env', () => {
    const config = loadConfig({
      TELEGRAM_BOT_TOKEN: 'token',
      ALLOWED_TELEGRAM_USER_ID: '123',
      MEMORY_MAX_RECENT_TURNS: '24'
    });

    assert.equal(config.memoryMaxRecentTurns, 24);
  });
});

describe('conversation memory', () => {
  it('uses a stable app-specific file name inside the configured data directory', () => {
    assert.equal(getMemoryFilePath('/tmp/life-agent-data'), '/tmp/life-agent-data/life-agent-memory.json');
  });

  it('keeps recent turns as full text when under the limit', async () => {
    const memory = createEmptyConversationMemory();

    await rememberTurn(memory, {
      user: '오늘 운동 계획 짜줘',
      assistant: '가볍게 30분 걷기부터 시작하세요.',
      maxRecentTurns: 3,
      summarize: async () => {
        throw new Error('summary should not run');
      }
    });

    assert.equal(memory.summary, '');
    assert.deepEqual(memory.recentTurns.map((turn) => turn.user), ['오늘 운동 계획 짜줘']);
    assert.equal(memory.recentTurns[0]?.assistant, '가볍게 30분 걷기부터 시작하세요.');
  });

  it('summarizes older full turns after the recent turn limit is exceeded', async () => {
    const memory = createEmptyConversationMemory();

    await rememberTurn(memory, {
      user: '첫 질문',
      assistant: '첫 답변',
      maxRecentTurns: 2,
      summarize: async () => '요약: 첫 질문과 첫 답변'
    });
    await rememberTurn(memory, {
      user: '둘째 질문',
      assistant: '둘째 답변',
      maxRecentTurns: 2,
      summarize: async () => '요약이 호출되면 안 됨'
    });
    await rememberTurn(memory, {
      user: '셋째 질문',
      assistant: '셋째 답변',
      maxRecentTurns: 2,
      summarize: async (input) => {
        assert.equal(input.previousSummary, '');
        assert.deepEqual(input.olderTurns.map((turn) => turn.user), ['첫 질문']);
        return '요약: 첫 질문과 첫 답변';
      }
    });

    assert.equal(memory.summary, '요약: 첫 질문과 첫 답변');
    assert.deepEqual(memory.recentTurns.map((turn) => turn.user), ['둘째 질문', '셋째 질문']);
  });

  it('builds context with compressed summary first and recent full turns after it', () => {
    const memory = createEmptyConversationMemory();
    memory.summary = '사용자는 TypeScript 봇을 만들고 있다.';
    memory.recentTurns = [
      {
        user: '최근 질문',
        assistant: '최근 답변',
        createdAt: '2026-05-12T00:00:00.000Z'
      }
    ];

    assert.equal(
      buildMemoryContext(memory),
      [
        '이전 대화 요약:',
        '사용자는 TypeScript 봇을 만들고 있다.',
        '',
        '최근 대화 원문:',
        '사용자: 최근 질문',
        '비서: 최근 답변'
      ].join('\n')
    );
  });

  it('adds memory context before the current user prompt', () => {
    assert.equal(
      buildPromptWithMemory('오늘은 뭐 하지?', '최근 대화 원문:\n사용자: 운동 계획'),
      [
        '아래는 이전 대화 맥락이다. 현재 질문에 필요한 경우에만 참고하고, 맥락과 충돌하면 현재 질문을 우선한다.',
        '',
        '최근 대화 원문:',
        '사용자: 운동 계획',
        '',
        '현재 질문:',
        '오늘은 뭐 하지?'
      ].join('\n')
    );
  });

  it('leaves prompts unchanged when there is no memory context', () => {
    assert.equal(buildPromptWithMemory('오늘은 뭐 하지?', ''), '오늘은 뭐 하지?');
  });

  it('persists chat memory to the configured data directory', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'life-agent-memory-test-'));

    try {
      const store = createFileMemoryStore(tempDir);
      const memory = createEmptyConversationMemory();
      memory.summary = '오래된 대화 요약';

      await store.set('123', memory);

      const reloadedStore = createFileMemoryStore(tempDir);
      assert.deepEqual(await reloadedStore.get('123'), memory);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('clears a single chat memory from the file store', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'life-agent-memory-test-'));

    try {
      const store = createFileMemoryStore(tempDir);
      const memory = createEmptyConversationMemory();
      memory.summary = '지워질 요약';

      await store.set('123', memory);
      await store.clear('123');

      assert.deepEqual(await store.get('123'), createEmptyConversationMemory());
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('buildImageRequest', () => {
  const config = loadConfig({
    TELEGRAM_BOT_TOKEN: 'token',
    ALLOWED_TELEGRAM_USER_ID: '123',
    FAST_MODEL: 'fast',
    DEEP_MODEL: 'deep',
    CODE_MODEL: 'code',
    VISION_MODEL: 'vision'
  });

  it('uses the vision model for a normal image caption', () => {
    const request = buildImageRequest('이 음식 뭐야?', config);

    assert.equal(request.model, 'vision');
    assert.equal(request.prompt, '이 음식 뭐야?');
    assert.equal(request.system, undefined);
  });

  it('uses the default image prompt when the image has no caption', () => {
    const request = buildImageRequest(undefined, config);

    assert.equal(request.model, 'vision');
    assert.equal(request.prompt, DEFAULT_IMAGE_PROMPT);
  });

  it('uses the deep model when the image caption starts with /deep', () => {
    const request = buildImageRequest('/deep 이거 자세히 봐줘', config);

    assert.equal(request.model, 'deep');
    assert.equal(request.prompt, '이거 자세히 봐줘');
    assert.equal(request.system, DEEP_SYSTEM_PROMPT);
  });

  it('uses the code model when the image caption starts with /code', () => {
    const request = buildImageRequest('/code 이 에러 화면 분석해줘', config);

    assert.equal(request.model, 'code');
    assert.equal(request.prompt, '이 에러 화면 분석해줘');
    assert.equal(request.system, CODE_SYSTEM_PROMPT);
  });

  it('allows Telegram group-style bot mentions in image captions', () => {
    const request = buildImageRequest('/deep@LifeAgentBot 이거 뭐야?', config);

    assert.equal(request.model, 'deep');
    assert.equal(request.prompt, '이거 뭐야?');
  });
});

describe('splitTelegramMessage', () => {
  it('splits long text below the Telegram edit-safe limit', () => {
    const chunks = splitTelegramMessage('a '.repeat(5000), 3900);

    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((chunk) => chunk.length <= 3900));
  });

  it('returns an empty list for blank text', () => {
    assert.deepEqual(splitTelegramMessage('   '), []);
  });
});

describe('markdownToTelegramHtml', () => {
  it('formats common markdown into Telegram HTML', () => {
    const html = markdownToTelegramHtml('**굵게** `code` [링크](https://example.com)');

    assert.equal(
      html,
      '<b>굵게</b> <code>code</code> <a href="https://example.com">링크</a>'
    );
  });

  it('escapes raw html while preserving code blocks', () => {
    const html = markdownToTelegramHtml(['<b>raw</b>', '', '```ts', 'const x = 1 < 2;', '```'].join('\n'));

    assert.equal(html, '&lt;b&gt;raw&lt;/b&gt;\n\n<pre><code>const x = 1 &lt; 2;</code></pre>');
  });
});

describe('registerCommands', () => {
  it('does not block startup when Telegram command registration fails', async () => {
    const bot = {
      api: {
        setMyCommands: async () => {
          throw new Error('telegram timeout');
        }
      }
    };

    await assert.doesNotReject(() => registerCommands(bot as never));
  });
});

describe('update ready notice', () => {
  it('round-trips chat id and branch after restart', () => {
    const text = buildUpdateReadyNotice({
      chatId: 123456789,
      branch: 'master',
      commit: 'abc1234'
    });

    assert.deepEqual(parseUpdateReadyNotice(text), {
      chatId: 123456789,
      branch: 'master',
      commit: 'abc1234'
    });
  });

  it('does not block startup when the ready notice cannot be sent', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'life-agent-update-test-'));
    const previousCwd = process.cwd();

    try {
      process.chdir(tempDir);
      await writeFile(
        '.update-ready',
        buildUpdateReadyNotice({
          chatId: 123456789,
          branch: 'master',
          commit: 'abc1234'
        }),
        'utf8'
      );

      const bot = {
        api: {
          sendMessage: async () => {
            throw new Error('telegram timeout');
          }
        }
      };

      await assert.doesNotReject(() => sendUpdateReadyNoticeIfNeeded(bot as never));
      assert.match(await readFile('.update-ready', 'utf8'), /LIFE_AGENT_UPDATE_READY/);
    } finally {
      process.chdir(previousCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('retries the ready notice until Telegram accepts it', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'life-agent-update-test-'));
    const previousCwd = process.cwd();
    let attempts = 0;
    const waits: number[] = [];

    try {
      process.chdir(tempDir);
      await writeFile(
        '.update-ready',
        buildUpdateReadyNotice({
          chatId: 123456789,
          branch: 'master',
          commit: 'abc1234'
        }),
        'utf8'
      );

      const bot = {
        api: {
          sendMessage: async () => {
            attempts += 1;
            if (attempts < 3) {
              throw new Error('telegram timeout');
            }
          }
        }
      };

      await retryUpdateReadyNoticeUntilSent(bot as never, {
        maxAttempts: 3,
        intervalMs: 25,
        wait: async (ms) => {
          waits.push(ms);
        }
      });

      assert.equal(attempts, 3);
      assert.deepEqual(waits, [25, 25]);
      await assert.rejects(() => readFile('.update-ready', 'utf8'));
    } finally {
      process.chdir(previousCwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('self update', () => {
  it('delegates the update procedure to the shell script', () => {
    assert.deepEqual(getSelfUpdateScriptArgs(123456789), [
      'scripts/self-update.sh',
      '123456789'
    ]);
  });
});
