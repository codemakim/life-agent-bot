import { Bot } from 'grammy';
import type { PhotoSize } from '@grammyjs/types/message.js';

function describeFetchFailure(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause;

  if (cause instanceof Error) {
    return `${error.message}: ${cause.message}`;
  }

  if (cause && typeof cause === 'object' && 'code' in cause) {
    return `${error.message}: ${(cause as { code?: string }).code}`;
  }

  return error.message;
}

// Telegram은 같은 사진을 여러 해상도로 보내므로, 모델에는 가장 큰 이미지를 넘긴다.
export function getLargestPhoto(photos: PhotoSize[]): PhotoSize | undefined {
  return photos
    .slice()
    .sort((a, b) => {
      const aSize = a.file_size ?? a.width * a.height;
      const bSize = b.file_size ?? b.width * b.height;
      return bSize - aSize;
    })[0];
}

export async function downloadPhotoAsBase64(
  bot: Bot,
  botToken: string,
  photo: PhotoSize
): Promise<string> {
  // Ollama vision 입력은 base64 이미지 배열을 받으므로 Telegram 파일을 내려받아 변환한다.
  const file = await bot.api.getFile(photo.file_id);

  if (!file.file_path) {
    throw new Error('Telegram photo file_path is missing');
  }

  const url = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(30_000)
    });
  } catch (error) {
    throw new Error(
      [
        'Telegram photo download fetch failed',
        `path=${file.file_path}`,
        `cause=${describeFetchFailure(error)}`
      ].join('\n')
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      [
        `Telegram photo download failed: ${response.status}`,
        `path=${file.file_path}`,
        body.slice(0, 500)
      ].join('\n')
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}
