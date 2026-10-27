// blocks/render-markdown.js — El MISMO JSON, convertido a Markdown
//
// Existe para demostrar la ventaja del contenido estructurado: con HTML
// guardado en la BD esto sería difícil; con bloques es un recorrido simple.
// Útil para exportar, para un newsletter en texto, para un repositorio Git...

// Escapa los caracteres que Markdown interpretaría como formato
const mdEscape = (s) => s.replace(/([\\`*_\[\]#<>])/g, '\\$1');

function span(s) {
  // En Markdown "* hola*" no es cursiva: los espacios deben quedar fuera de los asteriscos
  const [, lead, core, trail] = s.text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!core) return s.text;
  let text = mdEscape(core).replace(/\n/g, '  \n');
  if (s.marks.includes('italic')) text = `*${text}*`;
  if (s.marks.includes('bold')) text = `**${text}**`;
  if (s.href) text = `[${text}](${s.href})`;
  return lead + text + trail;
}
const inline = (spans) => spans.map(span).join('');

const renderers = {
  paragraph: b => inline(b.content),
  heading:   b => `${'#'.repeat(b.level)} ${inline(b.content)}`,
  quote:     b => `> ${inline(b.content)}`,
  list:      b => b.items.map((it, i) => `${b.style === 'number' ? `${i + 1}.` : '-'} ${inline(it)}`).join('\n'),
  image:     b => `![${mdEscape(b.alt)}](${b.url})${b.caption ? `\n*${mdEscape(b.caption)}*` : ''}`,
  callout:   b => `> **${b.tone === 'warning' ? 'Atención' : 'Nota'}:** ${inline(b.content)}`,

  // Markdown no tiene acordeones: lo DEGRADAMOS a algo equivalente que sí existe.
  // Cada pregunta como título de nivel 4, seguida de su contenido. Se pierde el
  // "abrir y cerrar", pero no se pierde información.
  accordion: b => b.items.map(it => `#### ${mdEscape(it.title)}\n\n${renderBlocks(it.blocks)}`).join('\n\n'),
};

const renderBlocks = (blocks) => blocks.map(b => renderers[b.type] ? renderers[b.type](b) : '').join('\n\n');

function renderMarkdown(title, doc) {
  return `# ${mdEscape(title)}\n\n${renderBlocks(doc.blocks)}\n`;
}

module.exports = { renderMarkdown, renderBlocks, mdEscape };
