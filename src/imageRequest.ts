import { AppConfig } from './config.js';
import { CODE_SYSTEM_PROMPT, DEEP_SYSTEM_PROMPT, DEFAULT_IMAGE_PROMPT } from './prompts.js';

export type ImageRequest = {
  model: string;
  prompt: string;
  system?: string;
  temperature: number;
  numCtx: number;
  numPredict: number;
};

export function buildImageRequest(caption: string | undefined, config: AppConfig): ImageRequest {
  const text = caption?.trim() ?? '';
  const command = parseCaptionCommand(text);

  if (command?.name === 'deep') {
    return {
      model: config.deepModel,
      prompt: command.prompt || DEFAULT_IMAGE_PROMPT,
      system: DEEP_SYSTEM_PROMPT,
      temperature: 0.2,
      numCtx: 8192,
      numPredict: 2000
    };
  }

  if (command?.name === 'code') {
    return {
      model: config.codeModel,
      prompt: command.prompt || DEFAULT_IMAGE_PROMPT,
      system: CODE_SYSTEM_PROMPT,
      temperature: 0.2,
      numCtx: 8192,
      numPredict: 2200
    };
  }

  return {
    model: config.visionModel,
    prompt: command?.prompt || text || DEFAULT_IMAGE_PROMPT,
    temperature: 0.2,
    numCtx: 8192,
    numPredict: 1600
  };
}

function parseCaptionCommand(text: string): { name: string; prompt: string } | undefined {
  const match = text.match(/^\/([a-zA-Z0-9_]+)(?:@[a-zA-Z0-9_]+)?(?:\s+([\s\S]*))?$/);

  if (!match) {
    return undefined;
  }

  return {
    name: match[1].toLowerCase(),
    prompt: match[2]?.trim() ?? ''
  };
}
