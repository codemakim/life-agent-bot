import { Bot, Context } from 'grammy';
import { markdownToTelegramHtml } from './telegramFormat.js';
import { splitTelegramMessage } from './telegramText.js';

const STREAM_EDIT_INTERVAL_MS = 2000;
const STREAM_EDIT_LIMIT = 3900;

// Telegram의 typing 표시는 금방 사라진다.
// Ollama 응답이 길어질 수 있으니 작업이 끝날 때까지 주기적으로 갱신한다.
export async function withTyping<T>(ctx: Context, task: () => Promise<T>): Promise<T> {
  if (!ctx.chat?.id) {
    return task();
  }

  await ctx.api.sendChatAction(ctx.chat.id, 'typing').catch(() => {});

  const timer = setInterval(() => {
    if (!ctx.chat?.id) {
      return;
    }

    ctx.api.sendChatAction(ctx.chat.id, 'typing').catch(() => {});
  }, 4000);

  try {
    return await task();
  } finally {
    clearInterval(timer);
  }
}

export async function replyLong(ctx: Context, text: string): Promise<void> {
  const chunks = splitTelegramMessage(text);

  if (chunks.length === 0) {
    await ctx.reply('응답이 비어 있습니다.');
    return;
  }

  for (const chunk of chunks) {
    await replyFormatted(ctx, chunk);
  }
}

// 각 명령어는 먼저 상태 메시지를 보낸다.
// 이 helper는 가능하면 그 메시지를 답변으로 수정하고, 길면 추가 메시지로 나눠 보낸다.
export async function replaceStatusWithLongText(
  ctx: Context,
  messageId: number,
  text: string
): Promise<void> {
  const chunks = splitTelegramMessage(text || '응답이 비어 있습니다.');

  if (!ctx.chat?.id || chunks.length === 0) {
    await replyLong(ctx, text);
    return;
  }

  await editFormatted(ctx, messageId, chunks[0]).catch(async () => {
    await replyFormatted(ctx, chunks[0]);
  });

  for (const chunk of chunks.slice(1)) {
    await replyFormatted(ctx, chunk);
  }
}

type StreamEditDecision = {
  text: string;
  lastSentText: string;
  lastEditAt: number;
  now: number;
  intervalMs: number;
};

export function shouldSendStreamEdit({
  text,
  lastSentText,
  lastEditAt,
  now,
  intervalMs
}: StreamEditDecision): boolean {
  return text.trim().length > 0 && text !== lastSentText && now - lastEditAt >= intervalMs;
}

export function createStreamStatusUpdater(ctx: Context, messageId: number) {
  let lastEditAt = Date.now();
  let lastSentText = '';
  let pending: Promise<void> = Promise.resolve();

  async function edit(text: string): Promise<void> {
    if (!ctx.chat?.id) {
      return;
    }

    const visibleText = text.length > STREAM_EDIT_LIMIT ? text.slice(0, STREAM_EDIT_LIMIT) : text;
    const now = Date.now();

    if (
      !shouldSendStreamEdit({
        text: visibleText,
        lastSentText,
        lastEditAt,
        now,
        intervalMs: STREAM_EDIT_INTERVAL_MS
      })
    ) {
      return;
    }

    lastEditAt = now;
    lastSentText = visibleText;
    pending = pending.then(() => editFormatted(ctx, messageId, visibleText)).catch(() => {});
    await pending;
  }

  return {
    update(text: string): Promise<void> {
      return edit(text);
    },

    async wait(): Promise<void> {
      await pending;
    }
  };
}

async function replyFormatted(ctx: Context, text: string): Promise<void> {
  const html = markdownToTelegramHtml(text);

  await ctx.reply(html, { parse_mode: 'HTML' }).catch(async () => {
    await ctx.reply(text);
  });
}

async function editFormatted(ctx: Context, messageId: number, text: string): Promise<void> {
  if (!ctx.chat?.id) {
    await replyFormatted(ctx, text);
    return;
  }

  const html = markdownToTelegramHtml(text);

  await ctx.api.editMessageText(ctx.chat.id, messageId, html, { parse_mode: 'HTML' }).catch(
    async () => {
      await ctx.api.editMessageText(ctx.chat!.id, messageId, text);
    }
  );
}

export function getCommandText(ctx: Context): string {
  // 단순 문자열 파싱 대신 Telegram의 bot_command entity를 쓴다.
  // 그룹 채팅에서는 /ask@BotName 같은 형태가 올 수 있기 때문이다.
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const entities = ctx.message && 'entities' in ctx.message ? ctx.message.entities : undefined;

  if (!text || !entities || entities.length === 0) {
    return '';
  }

  const botCommand = entities.find((entity) => entity.type === 'bot_command');

  if (!botCommand) {
    return '';
  }

  return text.slice(botCommand.offset + botCommand.length).trim();
}

export async function registerCommands(bot: Bot): Promise<void> {
  // Telegram 앱의 slash command 메뉴에 표시될 명령어 목록이다.
  try {
    await bot.api.setMyCommands([
      { command: 'ask', description: '빠른 질문' },
      { command: 'deep', description: '26B 모델로 깊은 질문' },
      { command: 'code', description: '코딩 질문' },
      { command: 'memory', description: '저장된 대화 맥락 확인' },
      { command: 'reset', description: '대화 맥락 초기화' },
      { command: 'status', description: '서버 상태 확인' },
      { command: 'update', description: '봇 업데이트' },
      { command: 'help', description: '사용법' }
    ]);
  } catch (error) {
    console.warn('Failed to register Telegram commands:', error);
  }
}
