function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttribute(text: string): string {
  return escapeHtml(text).replaceAll('"', '&quot;');
}

function extractCodeBlocks(text: string): { text: string; blocks: string[] } {
  const blocks: string[] = [];
  const replaced = text.replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g, (_match, code: string) => {
    const index = blocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`) - 1;
    return `\u0000CODE_BLOCK_${index}\u0000`;
  });

  return { text: replaced, blocks };
}

function restoreCodeBlocks(text: string, blocks: string[]): string {
  return text.replace(/\u0000CODE_BLOCK_(\d+)\u0000/g, (_match, index: string) => {
    return blocks[Number(index)] ?? '';
  });
}

function formatInlineMarkdown(text: string): string {
  return text
    .replace(/`([^`\n]+)`/g, (_match, code: string) => `<code>${escapeHtml(code)}</code>`)
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, label: string, url: string) => {
      return `<a href="${escapeAttribute(url)}">${escapeHtml(label)}</a>`;
    })
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/__([^_\n]+)__/g, '<b>$1</b>')
    .replace(/(^|[^\w])\*([^*\n]+)\*/g, '$1<i>$2</i>')
    .replace(/(^|[^\w])_([^_\n]+)_/g, '$1<i>$2</i>');
}

export function markdownToTelegramHtml(markdown: string): string {
  const { text, blocks } = extractCodeBlocks(markdown);
  const escaped = escapeHtml(text);
  const formatted = formatInlineMarkdown(escaped);

  return restoreCodeBlocks(formatted, blocks);
}
