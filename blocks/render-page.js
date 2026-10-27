// blocks/render-page.js — Convierte una PÁGINA (secciones + columnas) en HTML y Markdown
//
// Este archivo solo se ocupa de la ESTRUCTURA. El contenido de cada columna
// lo pinta renderBlocks(), el mismo que usan los artículos.

const html = require('./render-html');
const md = require('./render-markdown');

// La intención guardada en la BD ("1/3+2/3") se traduce aquí a una clase CSS.
// Cómo se ve cada clase lo decide el tema (views.js). Si mañana quieres que
// "1/3+2/3" sea 30/70 en vez de 33/67, cambias el CSS y no tocas ningún dato.
const LAYOUT_CLASS = {
  '1':           'layout-1',
  '1/2+1/2':     'layout-half-half',
  '1/3+2/3':     'layout-third-twothirds',
  '2/3+1/3':     'layout-twothirds-third',
  '1/3+1/3+1/3': 'layout-thirds',
};

function renderPageHtml(page) {
  return page.sections.map(s => `
<section class="section bg-${html.esc(s.background)}" id="s-${html.esc(s.id)}">
  <div class="section-inner ${LAYOUT_CLASS[s.layout] || 'layout-1'}">
    ${s.columns.map(c => `<div class="column content">${html.renderBlocks(c.blocks)}</div>`).join('\n    ')}
  </div>
</section>`).join('\n');
}

// Markdown no tiene columnas: se APLANAN en orden de lectura.
// Una línea horizontal (---) separa las secciones para no perder del todo la estructura.
function renderPageMarkdown(title, page) {
  const body = page.sections
    .map(s => s.columns.map(c => md.renderBlocks(c.blocks)).filter(Boolean).join('\n\n'))
    .join('\n\n---\n\n');
  return `# ${md.mdEscape(title)}\n\n${body}\n`;
}

module.exports = { renderPageHtml, renderPageMarkdown, LAYOUT_CLASS };
