// text.ts — Texto plano y Markdown a partir de los bloques
//
// El HTML ya no se genera aquí: ahora lo pinta Angular con componentes.
// La API conserva lo que no depende de un navegador: el extracto (para la
// meta description y los listados) y la exportación a Markdown.

import type { ArticleDoc, Block, PageDoc, Span } from './types.js';

// ── Texto plano ──
export function blocksText(blocks: Block[]): string {
  return blocks.map(b => {
    switch (b.type) {
      case 'image': return b.caption || b.alt || '';
      case 'list': return b.items.map(it => it.map(s => s.text).join('')).join(' ');
      case 'accordion': return b.items.map(it => `${it.title} ${blocksText(it.blocks)}`).join(' ');
      default: return b.content.map(s => s.text).join('');
    }
  }).join(' ');
}

export const pageBlocks = (page: PageDoc): Block[] =>
  page.sections.flatMap(s => s.columns.flatMap(c => c.blocks));

export function makeExcerpt(doc: ArticleDoc | PageDoc, max = 160): string {
  const blocks = 'sections' in doc ? pageBlocks(doc) : doc.blocks;
  const text = blocksText(blocks).replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 3).trimEnd() + '...' : text;
}

// ── Markdown ──
const mdEscape = (s: string) => s.replace(/([\\`*_[\]#<>~=])/g, '\\$1');

function span(s: Span): string {
  const [, lead, core, trail] = s.text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
  if (!core) return s.text;
  // El código en línea va SIN escapar: dentro de `...` Markdown no interpreta nada.
  // Si el texto ya contiene una comilla invertida, se usan dos para delimitarlo.
  let text = s.marks.includes('code')
    ? (core.includes('`') ? `\`\` ${core} \`\`` : `\`${core}\``)
    : mdEscape(core).replace(/\n/g, '  \n');
  // ==texto== no es Markdown estándar, pero lo entienden muchos editores (Obsidian, Typora...)
  if (s.marks.includes('highlight')) text = `==${text}==`;
  if (s.marks.includes('strike')) text = `~~${text}~~`;
  if (s.marks.includes('italic')) text = `*${text}*`;
  if (s.marks.includes('bold')) text = `**${text}**`;
  if (s.href) text = `[${text}](${s.href})`;
  return lead + text + trail;
}
const inline = (spans: Span[]) => spans.map(span).join('');

function blockMd(b: Block): string {
  switch (b.type) {
    case 'paragraph': return inline(b.content);
    case 'heading': return `${'#'.repeat(b.level)} ${inline(b.content)}`;
    case 'quote': return `> ${inline(b.content)}`;
    case 'list': return b.items.map((it, i) => `${b.style === 'number' ? `${i + 1}.` : '-'} ${inline(it)}`).join('\n');
    case 'image': return `![${mdEscape(b.alt)}](${b.url})${b.caption ? `\n*${mdEscape(b.caption)}*` : ''}`;
    case 'callout': return `> **${b.tone === 'warning' ? 'Atención' : 'Nota'}:** ${inline(b.content)}`;
    case 'accordion': return b.items.map(it => `#### ${mdEscape(it.title)}\n\n${blocksMd(it.blocks)}`).join('\n\n');
  }
}
const blocksMd = (blocks: Block[]) => blocks.map(blockMd).join('\n\n');

export function toMarkdown(title: string, doc: ArticleDoc | PageDoc): string {
  const body = 'sections' in doc
    ? doc.sections.map(s => s.columns.map(c => blocksMd(c.blocks)).filter(Boolean).join('\n\n')).join('\n\n---\n\n')
    : blocksMd(doc.blocks);
  return `# ${mdEscape(title)}\n\n${body}\n`;
}
