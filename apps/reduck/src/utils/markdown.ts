import { marked } from 'marked';
import DOMPurify from 'dompurify';
import TurndownService from 'turndown';

marked.setOptions({ breaks: true, gfm: true } as Parameters<typeof marked.setOptions>[0]);

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
});

export function markdownToHtml(md: string): string {
  if (!md.trim()) return '';
  const raw = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
}

export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return '';
  return turndown.turndown(html);
}

export function isMarkdown(text: string): boolean {
  return [
    /^#{1,6}\s/m, /\*\*[^*]+\*\*/, /\*[^*]+\*/,
    /^\s*[-*+]\s/m, /^\s*\d+\.\s/m, /\[.+\]\(.+\)/,
    /```[\s\S]*```/, /^\s*>/m, /\|.+\|/,
  ].some((p) => p.test(text));
}

export function richTextToMarkdown(clipboardData: DataTransfer): string {
  const html = clipboardData.getData('text/html');
  return html ? htmlToMarkdown(html) : clipboardData.getData('text/plain');
}

export async function copyAsRichText(html: string): Promise<boolean> {
  try {
    const htmlBlob = new Blob([html], { type: 'text/html' });
    const div = document.createElement('div');
    div.innerHTML = html;
    const plain = div.textContent ?? div.innerText ?? '';
    const textBlob = new Blob([plain], { type: 'text/plain' });
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob }),
    ]);
    return true;
  } catch {
    try {
      const div = document.createElement('div');
      div.innerHTML = html;
      await navigator.clipboard.writeText(div.textContent ?? '');
      return true;
    } catch {
      return false;
    }
  }
}
