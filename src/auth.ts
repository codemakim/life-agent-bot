import { Context } from 'grammy';
import { AppConfig } from './config.js';

// 이 개인용 봇의 접근 제어 기준은 Telegram user id다.
// setup mode는 명시적으로 켜야 하며, 빈 .env 때문에 봇이 공개되지 않게 한다.
export function isAllowedUser(ctx: Context, config: AppConfig): boolean {
  const userId = ctx.from?.id;

  if (config.allowedTelegramUserIds.length > 0) {
    return config.allowedTelegramUserIds.includes(String(userId));
  }

  return config.allowAllUsersDuringSetup;
}

export async function rejectIfNotAllowed(ctx: Context, config: AppConfig): Promise<boolean> {
  if (isAllowedUser(ctx, config)) {
    return false;
  }

  await ctx.reply(
    [
      '허용되지 않은 사용자입니다.',
      `your telegram user id: ${ctx.from?.id ?? 'unknown'}`,
      '',
      '이 id를 .env의 ALLOWED_TELEGRAM_USER_ID에 넣으면 됩니다.'
    ].join('\n')
  );

  return true;
}

// 처음 설정할 때는 봇에게 한 번 말을 걸고,
// 응답에 찍힌 user id를 .env에 옮기는 방식이 가장 단순하다.
export function setupModeNotice(ctx: Context, config: AppConfig): string[] {
  if (config.allowedTelegramUserIds.length > 0 || !config.allowAllUsersDuringSetup) {
    return [];
  }

  return [
    '',
    'SETUP MODE: 현재 모든 사용자를 임시 허용 중입니다.',
    `your telegram user id: ${ctx.from?.id ?? 'unknown'}`,
    '.env에 ALLOWED_TELEGRAM_USER_ID를 넣고 ALLOW_ALL_USERS_DURING_SETUP=false로 바꾸세요.'
  ];
}
