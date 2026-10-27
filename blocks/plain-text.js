// blocks/plain-text.js — Solo el texto, sin formato
// Sirve para el extracto, para un buscador, para contar palabras...

function blocksText(blocks) {
  return blocks.map(b => {
    if (b.type === 'image') return b.caption || b.alt || '';
    if (b.type === 'list') return b.items.map(it => it.map(s => s.text).join('')).join(' ');
    // Acordeón: título + texto de sus bloques internos (recursión otra vez).
    // Así un buscador encuentra el artículo aunque la respuesta esté "cerrada".
    if (b.type === 'accordion') return b.items.map(it => `${it.title} ${blocksText(it.blocks)}`).join(' ');
    return b.content.map(s => s.text).join('');
  }).join(' ');
}

function plainText(doc) {
  return blocksText(doc.blocks).replace(/\s+/g, ' ').trim();
}

// Una página no tiene "blocks" en la raíz: tiene secciones con columnas.
// La aplanamos leyendo en orden (sección 1 col 1, sección 1 col 2, sección 2...).
const pageBlocks = (page) => page.sections.flatMap(s => s.columns.flatMap(c => c.blocks));

function makeExcerpt(doc, max = 160) {
  const text = doc.sections
    ? blocksText(pageBlocks(doc)).replace(/\s+/g, ' ').trim()
    : plainText(doc);
  return text.length > max ? text.slice(0, max - 3).trimEnd() + '...' : text;
}

module.exports = { plainText, makeExcerpt, pageBlocks };
