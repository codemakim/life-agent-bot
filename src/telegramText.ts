export function splitTelegramMessage(text: string, limit = 3900): string[] {
  const chunks: string[] = [];
  let rest = text.trim();

  while (rest.length > limit) {
    const slice = rest.slice(0, limit);
    // 가능하면 문단/줄/문장/공백 기준으로 자른다.
    // 다만 너무 앞에서 잘리면 메시지가 잘게 쪼개지므로 최소 위치를 둔다.
    const breakPoint = Math.max(
      slice.lastIndexOf('\n\n'),
      slice.lastIndexOf('\n'),
      slice.lastIndexOf('. '),
      slice.lastIndexOf(' ')
    );
    const cut = breakPoint > 1000 ? breakPoint : limit;

    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest.length > 0) {
    chunks.push(rest);
  }

  return chunks;
}
