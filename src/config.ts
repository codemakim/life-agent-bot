export type AppConfig = {
  telegramBotToken: string;
  allowedTelegramUserIds: string[];
  allowAllUsersDuringSetup: boolean;
  ollamaBaseUrl: string;
  fastModel: string;
  deepModel: string;
  codeModel: string;
  visionModel: string;
};

function readBoolean(value: string | undefined): boolean {
  return value?.toLowerCase() === 'true';
}

function readUserIds(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

// 환경변수 검증은 시작 시점에 한 번만 한다.
// 운영 모드에서는 허용된 Telegram user id가 없으면 봇을 띄우지 않는다.
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const telegramBotToken = env.TELEGRAM_BOT_TOKEN?.trim();
  const allowedTelegramUserIds = readUserIds(env.ALLOWED_TELEGRAM_USER_ID);
  const allowAllUsersDuringSetup = readBoolean(env.ALLOW_ALL_USERS_DURING_SETUP);

  if (!telegramBotToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }

  if (allowedTelegramUserIds.length === 0 && !allowAllUsersDuringSetup) {
    throw new Error(
      'ALLOWED_TELEGRAM_USER_ID is required unless ALLOW_ALL_USERS_DURING_SETUP=true'
    );
  }

  // Ollama 모델 이름은 PC마다 다를 수 있으니 .env에서 바꿀 수 있게 둔다.
  return {
    telegramBotToken,
    allowedTelegramUserIds,
    allowAllUsersDuringSetup,
    ollamaBaseUrl: env.OLLAMA_BASE_URL?.trim() || 'http://localhost:11434',
    fastModel: env.FAST_MODEL?.trim() || 'gemma4:e4b',
    deepModel: env.DEEP_MODEL?.trim() || 'gemma4:26b',
    codeModel: env.CODE_MODEL?.trim() || 'gemma4:26b',
    visionModel: env.VISION_MODEL?.trim() || env.FAST_MODEL?.trim() || 'gemma4:e4b'
  };
}
