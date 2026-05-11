import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { buildImageRequest } from '../src/imageRequest.js';
import { CODE_SYSTEM_PROMPT, DEEP_SYSTEM_PROMPT, DEFAULT_IMAGE_PROMPT } from '../src/prompts.js';
import { markdownToTelegramHtml } from '../src/telegramFormat.js';
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
});
