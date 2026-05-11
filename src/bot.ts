import { Bot, Context } from 'grammy';
import { rejectIfNotAllowed, setupModeNotice } from './auth.js';
import { AppConfig } from './config.js';
import { buildImageRequest } from './imageRequest.js';
import { AskOllamaInput, OllamaClient, createOllamaClient } from './ollama.js';
import { CODE_SYSTEM_PROMPT, DEEP_SYSTEM_PROMPT } from './prompts.js';
import { getGitValue } from './shell.js';
import {
  getCommandText,
  registerCommands,
  replaceStatusWithLongText,
  withTyping
} from './telegram.js';
import { downloadPhotoAsBase64, getLargestPhoto } from './telegramPhoto.js';
import { runSelfUpdate, sendUpdateReadyNoticeIfNeeded } from './update.js';

export type LifeAgentBot = {
  bot: Bot;
  start(): Promise<void>;
};

export function createLifeAgentBot(config: AppConfig): LifeAgentBot {
  const bot = new Bot(config.telegramBotToken);
  const ollama = createOllamaClient(config);

  // 핸들러 등록과 실제 polling 시작을 분리한다.
  // 그래야 나중에 테스트나 초기화 로직을 붙일 때 봇이 바로 실행되지 않는다.
  registerHandlers(bot, config, ollama);

  return {
    bot,
    async start() {
      bot.catch((error) => {
        console.error('Bot error:', error);
      });

      // slash command는 시작할 때마다 등록한다.
      // Telegram에서는 덮어쓰기처럼 동작하므로 별도 배포 단계가 필요 없다.
      await registerCommands(bot);
      await sendUpdateReadyNoticeIfNeeded(bot);
      bot.start();
    }
  };
}

function registerHandlers(bot: Bot, config: AppConfig, ollama: OllamaClient): void {
  // 모든 명령어는 가장 먼저 허용 사용자 검사를 한다.
  // 나중에 명령어를 추가해도 이 순서를 유지해야 한다.
  bot.command('start', async (ctx) => {
    if (await rejectIfNotAllowed(ctx, config)) return;

    await ctx.reply(
      [
        'Life Agent 준비됨.',
        ...setupModeNotice(ctx, config),
        '',
        '명령어:',
        '/ask 질문 - 빠른 모델',
        '/deep 질문 - 26B 모델',
        '/code 질문 - 코딩용',
        '/status - 상태 확인',
        '/update - git pull 후 재시작',
        '/help - 사용법',
        '사진 + caption - 이미지 질문',
        '사진 + /deep caption - 26B 이미지 질문'
      ].join('\n')
    );
  });

  bot.command('help', async (ctx) => {
    if (await rejectIfNotAllowed(ctx, config)) return;

    await ctx.reply(
      [
        '사용법',
        ...setupModeNotice(ctx, config),
        '',
        `/ask 오늘 할 일 정리 좀 도와줘`,
        `/deep 이 설계 방향이 맞는지 깊게 봐줘`,
        `/code TypeScript에서 이 함수 설계 어떻게 할까?`,
        `/status`,
        `/update`,
        '',
        '그냥 메시지를 보내면 /ask와 같은 빠른 모델로 답합니다.',
        '사진을 보내면 이미지 분석 모델로 답합니다.',
        '사진 caption을 /deep 질문 또는 /code 질문으로 시작하면 해당 모델로 이미지를 봅니다.'
      ].join('\n')
    );
  });

  bot.command('ask', async (ctx) => {
    if (await rejectIfNotAllowed(ctx, config)) return;

    const prompt = getCommandText(ctx);

    if (!prompt) {
      await ctx.reply('사용법: /ask 질문');
      return;
    }

    await sendPromptToOllama(ctx, ollama, `${config.fastModel}로 답변 중...`, {
      model: config.fastModel,
      prompt,
      // 빠른 질문용: 일상적인 질문을 짧은 context와 응답 길이로 처리한다.
      temperature: 0.3,
      numCtx: 4096,
      numPredict: 1200
    });
  });

  bot.command('deep', async (ctx) => {
    if (await rejectIfNotAllowed(ctx, config)) return;

    const prompt = getCommandText(ctx);

    if (!prompt) {
      await ctx.reply('사용법: /deep 질문');
      return;
    }

    await sendPromptToOllama(ctx, ollama, `${config.deepModel}로 깊게 보는 중...`, {
      model: config.deepModel,
      prompt,
      system: DEEP_SYSTEM_PROMPT,
      // 깊은 분석용: temperature를 낮추고 context를 키워 더 안정적으로 답하게 한다.
      temperature: 0.2,
      numCtx: 8192,
      numPredict: 2000
    });
  });

  bot.command('code', async (ctx) => {
    if (await rejectIfNotAllowed(ctx, config)) return;

    const prompt = getCommandText(ctx);

    if (!prompt) {
      await ctx.reply('사용법: /code 코딩 질문');
      return;
    }

    await sendPromptToOllama(ctx, ollama, `${config.codeModel} 코딩 모드로 답변 중...`, {
      model: config.codeModel,
      prompt,
      system: CODE_SYSTEM_PROMPT,
      // 코딩 답변은 코드 블록 때문에 길어지기 쉬워 응답 토큰 예산을 가장 크게 둔다.
      temperature: 0.2,
      numCtx: 8192,
      numPredict: 2200
    });
  });

  bot.command('status', async (ctx) => {
    if (await rejectIfNotAllowed(ctx, config)) return;

    const status = await ctx.reply('상태 확인 중...');

    try {
      // 일부 상태 조회가 실패해도 /status 자체는 응답하도록 allSettled를 쓴다.
      const [ollamaHealth, ollamaModels, gitHash, gitBranch] = await Promise.allSettled([
        fetch(config.ollamaBaseUrl).then((res) => res.text()),
        ollama.getTags(),
        getGitValue(['rev-parse', '--short', 'HEAD']),
        getGitValue(['branch', '--show-current'])
      ]);

      const text = [
        '상태',
        '',
        `Ollama: ${ollamaHealth.status === 'fulfilled' ? ollamaHealth.value.trim() : 'FAIL'}`,
        `Branch: ${gitBranch.status === 'fulfilled' ? gitBranch.value : 'unknown'}`,
        `Commit: ${gitHash.status === 'fulfilled' ? gitHash.value : 'unknown'}`,
        '',
        'Models:',
        ollamaModels.status === 'fulfilled' ? ollamaModels.value : '모델 목록 조회 실패',
        '',
        `FAST_MODEL: ${config.fastModel}`,
        `DEEP_MODEL: ${config.deepModel}`,
        `CODE_MODEL: ${config.codeModel}`,
        `VISION_MODEL: ${config.visionModel}`
      ].join('\n');

      await replaceStatusWithLongText(ctx, status.message_id, text);
    } catch (error) {
      await replaceStatusWithLongText(
        ctx,
        status.message_id,
        `상태 확인 실패: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  bot.command('update', async (ctx) => {
    if (await rejectIfNotAllowed(ctx, config)) return;

    const status = await ctx.reply('업데이트 시작: 현재 브랜치 pull --ff-only → npm install → npm run build');

    try {
      if (!ctx.chat?.id || typeof ctx.chat.id !== 'number') {
        throw new Error('update ready notice requires a numeric chat id');
      }

      const output = await runSelfUpdate(ctx.chat.id);
      await replaceStatusWithLongText(ctx, status.message_id, output);

      // systemd의 Restart=always가 프로세스를 다시 띄우는 전제다.
      // 다음 부팅 때 .update-ready를 읽고 준비 완료 메시지를 보낸다.
      setTimeout(() => {
        process.exit(0);
      }, 1500);
    } catch (error) {
      await replaceStatusWithLongText(
        ctx,
        status.message_id,
        `업데이트 실패: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  bot.on('message:text', async (ctx) => {
    if (await rejectIfNotAllowed(ctx, config)) return;

    const text = ctx.message.text.trim();

    if (!text || text.startsWith('/')) {
      return;
    }

    // 일반 텍스트는 /ask처럼 처리한다. 개인 채팅에서 매번 명령어를 치지 않아도 된다.
    await sendPromptToOllama(ctx, ollama, `${config.fastModel}로 답변 중...`, {
      model: config.fastModel,
      prompt: text,
      temperature: 0.3,
      numCtx: 4096,
      numPredict: 1200
    });
  });

  bot.on('message:photo', async (ctx) => {
    if (await rejectIfNotAllowed(ctx, config)) return;

    const photo = getLargestPhoto(ctx.message.photo);

    if (!photo) {
      await ctx.reply('이미지를 찾지 못했습니다.');
      return;
    }

    const imageRequest = buildImageRequest(ctx.message.caption, config);
    const status = await ctx.reply(`${imageRequest.model}로 이미지 보는 중...`);

    try {
      const image = await withTyping(ctx, () =>
        downloadPhotoAsBase64(bot, config.telegramBotToken, photo)
      );
      const answer = await withTyping(ctx, () =>
        ollama.ask({
          ...imageRequest,
          images: [image]
        })
      );

      await replaceStatusWithLongText(ctx, status.message_id, answer || '응답이 비어 있습니다.');
    } catch (error) {
      await replaceStatusWithLongText(
        ctx,
        status.message_id,
        `이미지 처리 오류: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

async function sendPromptToOllama(
  ctx: Context,
  ollama: OllamaClient,
  statusText: string,
  input: AskOllamaInput
): Promise<void> {
  // 먼저 짧은 상태 메시지를 보내고, 모델 응답이 오면 그 메시지를 수정한다.
  // Telegram 길이 제한을 넘으면 helper가 여러 메시지로 나눠 보낸다.
  const status = await ctx.reply(statusText);

  try {
    const answer = await withTyping(ctx, () => ollama.ask(input));
    await replaceStatusWithLongText(ctx, status.message_id, answer || '응답이 비어 있습니다.');
  } catch (error) {
    await replaceStatusWithLongText(
      ctx,
      status.message_id,
      `오류: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
