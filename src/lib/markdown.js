import { marked } from 'marked';
import DOMPurify from 'dompurify';

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

marked.use({
  gfm: true,
  renderer: {
    // Code blocks get a copy button; diffs get coloured lines
    code({ text, lang }) {
      const language = (lang || '').trim().split(/\s/)[0].toLowerCase();
      const body =
        language === 'diff'
          ? text
              .split('\n')
              .map((line) => {
                const cls = line.startsWith('+++') || line.startsWith('---') ? 'd-file' : line.startsWith('+') ? 'd-add' : line.startsWith('-') ? 'd-del' : line.startsWith('@@') ? 'd-hunk' : '';
                return `<span class="${cls}">${escape(line) || ' '}</span>`;
              })
              .join('\n')
          : escape(text);
      const wrap = ['', 'text', 'txt', 'markdown', 'md', 'plaintext'].includes(language);
      return `<div class="code${wrap ? ' code--wrap' : ''}"><div class="code__bar"><span>${escape(language || 'text')}</span><button type="button" class="copy-btn">Copy</button></div><pre><code>${body}</code></pre></div>`;
    },
  },
});

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export const renderMarkdown = (md) => DOMPurify.sanitize(marked.parse(md || ''));

/** Splits the streamed plan into its "## " sections. */
export function splitSections(md) {
  const parts = [];
  let current = null;
  for (const line of (md || '').split('\n')) {
    const h = line.match(/^##\s+(.+?)\s*#*\s*$/);
    if (h) {
      current = { title: h[1].trim(), body: '' };
      parts.push(current);
    } else if (current) current.body += `${line}\n`;
    else if (line.trim()) {
      current = { title: '', body: `${line}\n` };
      parts.push(current);
    }
  }
  return parts;
}
