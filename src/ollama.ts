import { AppConfig } from './config.js';
import { DEFAULT_SYSTEM_PROMPT } from './prompts.js';

type OllamaChatResponse = {
  message?: {
    role?: string;
    content?: string;
  };
  done?: boolean;
};

export type AskOllamaInput = {
  model: string;
  prompt: string;
  images?: string[];
  system?: string;
  temperature?: number;
  numCtx?: number;
  numPredict?: number;
};

export type OllamaClient = {
  ask(input: AskOllamaInput): Promise<string>;
  getTags(): Promise<string>;
};

// Ollama HTTP API 호출은 이 파일에 모아둔다.
// Telegram 핸들러가 API payload 구조를 몰라도 되게 하기 위해서다.
export function createOllamaClient(config: AppConfig): OllamaClient {
  return {
    async ask(input) {
      const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: input.model,
          // MVP에서는 non-streaming으로 받는다.
          // 그래야 "답변 중..." 메시지를 최종 답변으로 한 번에 수정하기 쉽다.
          stream: false,
          think: false,
          messages: [
            {
              role: 'system',
              content: input.system ?? DEFAULT_SYSTEM_PROMPT
            },
            {
              role: 'user',
              content: input.prompt,
              ...(input.images && input.images.length > 0 ? { images: input.images } : {})
            }
          ],
          options: {
            // 코드 내부에서는 camelCase를 쓰고,
            // Ollama로 보낼 때만 API 형식인 snake_case로 바꾼다.
            temperature: input.temperature ?? 0.3,
            num_ctx: input.numCtx ?? 4096,
            num_predict: input.numPredict ?? 1200
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status} ${await response.text()}`);
      }

      const json = (await response.json()) as OllamaChatResponse;

      return json.message?.content?.trim() ?? '';
    },

    async getTags() {
      // /status에서 로컬 모델 목록을 보여주기 위한 호출이다.
      // Ollama가 죽어 있어도 전체 봇이 죽지 않도록 호출자가 실패를 처리한다.
      const response = await fetch(`${config.ollamaBaseUrl}/api/tags`);

      if (!response.ok) {
        throw new Error(`Ollama tags error: ${response.status}`);
      }

      const json = (await response.json()) as {
        models?: Array<{
          name?: string;
          size?: number;
          modified_at?: string;
        }>;
      };
      const models = json.models ?? [];

      if (models.length === 0) {
        return '모델 없음';
      }

      return models
        .map((model) => {
          const sizeGb = model.size
            ? `${(model.size / 1024 / 1024 / 1024).toFixed(1)}GB`
            : 'unknown size';
          return `- ${model.name ?? 'unknown'} (${sizeGb})`;
        })
        .join('\n');
    }
  };
}
