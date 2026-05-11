import { Bot } from 'grammy';
import type { PhotoSize } from '@grammyjs/types/message.js';

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
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Telegram photo download failed: ${response.status} ${await response.text()}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}
