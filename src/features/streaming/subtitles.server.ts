// Server-only subtitle normalization: accepts SRT or WebVTT, returns safe WebVTT text.
const TIME = /(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->\s*(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}/;

export function srtToVtt(srt: string): string {
  const body = srt
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.trim().split("\n");
      if (/^\d+$/.test(lines[0] ?? "")) lines.shift();
      if (!lines[0] || !TIME.test(lines[0])) return null;
      lines[0] = lines[0].replace(/(\d),(\d)/g, "$1.$2");
      return lines.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

/** Strips scriptable markup; WebVTT only allows simple styling tags. */
function sanitize(vtt: string) {
  return vtt.replace(/<(?!\/?(b|i|u|c|v|lang|ruby|rt)(\.[\w.-]+)?(\s[^>]*)?>)[^>]*>/gi, "");
}

export function toWebVtt(content: string, filename: string): string {
  const text = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const isVtt = text.trimStart().startsWith("WEBVTT");
  if (!isVtt && !/\.srt$/i.test(filename) && !TIME.test(text)) throw new Error("Unsupported subtitle file. Upload .vtt or .srt");
  const vtt = isVtt ? text : srtToVtt(text);
  if (!TIME.test(vtt)) throw new Error("No subtitle cues found in this file");
  return sanitize(vtt);
}
