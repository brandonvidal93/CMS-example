// blocks/render-html.js — Convierte el JSON en HTML para el sitio web
//
// Clave de seguridad: TODO el texto pasa por esc(). Nunca insertamos HTML
// que venga del usuario, solo HTML que este archivo construye. Por eso
// ya no hace falta sanitizar: no hay HTML ajeno que limpiar.

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Un span -> <strong><em><a>texto</a></em></strong>
function span(s) {
  let html = esc(s.text).replace(/\n/g, '<br>');
  if (s.marks.includes('italic')) html = `<em>${html}</em>`;
  if (s.marks.includes('bold')) html = `<strong>${html}</strong>`;
  if (s.href) html = `<a href="${esc(s.href)}">${html}</a>`;
  return html;
}
const inline = (spans) => spans.map(span).join('');

// Un renderizador por tipo de bloque
const renderers = {
  paragraph: b => `<p>${inline(b.content)}</p>`,
  heading:   b => `<h${b.level}>${inline(b.content)}</h${b.level}>`,
  quote:     b => `<blockquote>${inline(b.content)}</blockquote>`,
  list:      b => {
    const tag = b.style === 'number' ? 'ol' : 'ul';
    return `<${tag}>${b.items.map(it => `<li>${inline(it)}</li>`).join('')}</${tag}>`;
  },
  image:     b => `<figure><img src="${esc(b.url)}" alt="${esc(b.alt)}" loading="lazy">${
                 b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`,
  callout:   b => `<aside class="callout callout-${esc(b.tone)}">${inline(b.content)}</aside>`,

  // <details>/<summary> es un acordeón NATIVO de HTML: se abre y cierra sin
  // JavaScript, funciona con teclado y lo anuncian bien los lectores de pantalla.
  // El interior se pinta con renderBlocks(): la misma recursión que en el esquema.
  accordion: b => `<div class="accordion">${b.items.map(it => `
  <details>
    <summary>${esc(it.title)}</summary>
    <div class="accordion-body">${renderBlocks(it.blocks)}</div>
  </details>`).join('')}
</div>`,
};

function renderBlocks(blocks) {
  return blocks
    .map(b => renderers[b.type] ? renderers[b.type](b) : '') // tipo desconocido: se ignora
    .join('\n');
}

const renderHtml = (doc) => renderBlocks(doc.blocks);

module.exports = { renderHtml, renderBlocks, esc };
