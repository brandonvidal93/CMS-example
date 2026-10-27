// blocks/schema.js — El "contrato" del contenido
//
// Define qué forma puede tener un documento. Todo lo que entra a la base de
// datos pasa por validateDocument(): lo que no está en esta lista simplemente
// no puede existir. Esto reemplaza a la sanitización de HTML de la versión
// anterior: en vez de "limpiar" algo peligroso, solo aceptamos algo conocido.
//
// Forma de un documento:
//
// {
//   "version": 1,
//   "blocks": [
//     { "id": "a1b2c3d4", "type": "heading",   "level": 2, "content": [Span] },
//     { "id": "...",      "type": "paragraph", "content": [Span] },
//     { "id": "...",      "type": "list",      "style": "bullet", "items": [[Span], [Span]] },
//     { "id": "...",      "type": "quote",     "content": [Span] },
//     { "id": "...",      "type": "image",     "url": "https://...", "alt": "...", "caption": "..." },
//     { "id": "...",      "type": "callout",   "tone": "info", "content": [Span] },
//     { "id": "...",      "type": "accordion", "items": [
//         { "title": "¿Pregunta?", "blocks": [ ...bloques normales... ] }
//     ] }
//   ]
// }
//
// El acordeón es un bloque CONTENEDOR: dentro de cada elemento hay otra lista
// de bloques. Por eso la validación es recursiva (validateBlocks se llama a sí
// misma). Para no complicarlo, dentro de un acordeón no se permite otro acordeón.
//
// Un Span es un trozo de texto con formato:
//   { "text": "importante", "marks": ["bold"] }
//   { "text": "aquí", "marks": [], "href": "https://ejemplo.com" }

const SCHEMA_VERSION = 1;

const ALLOWED_MARKS = ['bold', 'italic'];
const LIMITS = { blocks: 500, listItems: 200, textPerSpan: 20000, url: 2000, shortText: 300, accordionItems: 30 };

// Tipos que NO pueden ir dentro de un contenedor (evita acordeón dentro de acordeón)
const CONTAINER_TYPES = ['accordion'];

// Cada tipo de bloque declara cómo validarse. Añadir un tipo nuevo
// (un video, una tabla, un botón) = añadir una entrada aquí + en los renderizadores.
const BLOCK_TYPES = {
  paragraph: (b, err) => ({ content: spans(b.content, err) }),

  heading: (b, err) => {
    if (![2, 3].includes(b.level)) err('level debe ser 2 o 3');
    return { level: b.level, content: spans(b.content, err) };
  },

  list: (b, err) => {
    if (!['bullet', 'number'].includes(b.style)) err('style debe ser "bullet" o "number"');
    if (!Array.isArray(b.items) || b.items.length === 0) err('items debe ser una lista con al menos un elemento');
    else if (b.items.length > LIMITS.listItems) err(`máximo ${LIMITS.listItems} elementos`);
    const items = (Array.isArray(b.items) ? b.items : []).map((it, i) => spans(it, m => err(`items[${i}]: ${m}`)));
    return { style: b.style, items };
  },

  quote: (b, err) => ({ content: spans(b.content, err) }),

  image: (b, err) => {
    if (!isSafeUrl(b.url)) err('url debe empezar por http:// o https://');
    return { url: b.url, alt: shortText(b.alt, 'alt', err), caption: shortText(b.caption, 'caption', err) };
  },

  callout: (b, err) => {
    if (!['info', 'warning'].includes(b.tone)) err('tone debe ser "info" o "warning"');
    return { tone: b.tone, content: spans(b.content, err) };
  },

  // El tercer parámetro (ctx) lo usan solo los contenedores: trae el conjunto de
  // ids ya vistos y si estamos dentro de otro contenedor.
  accordion: (b, err, ctx) => {
    if (!Array.isArray(b.items)) { err('items debe ser una lista'); return { items: [] }; }
    if (b.items.length > LIMITS.accordionItems) err(`máximo ${LIMITS.accordionItems} elementos`);

    const items = [];
    b.items.forEach((item, i) => {
      let innerErrors = 0;
      const itemErr = msg => { innerErrors++; err(`elemento ${i + 1}: ${msg}`); };
      if (!item || typeof item !== 'object') return itemErr('formato no válido');

      const title = shortText(item.title, 'title', itemErr).trim();
      // ← aquí está la recursión: los bloques internos se validan igual que los del documento
      const blocks = validateBlocks(item.blocks, itemErr, { ...ctx, insideContainer: true });
      if (innerErrors) return;                               // ya se informó el problema concreto

      if (!title && blocks.length === 0) return;            // elemento vacío: se descarta en silencio
      if (!title) return itemErr('falta el título');
      if (blocks.length === 0) return itemErr(`"${title}" no tiene contenido`);
      items.push({ title, blocks });
    });
    return { items };
  },
};

// ─── Validación de piezas pequeñas ───

function isSafeUrl(url) {
  if (typeof url !== 'string' || url.length > LIMITS.url) return false;
  try {
    const u = new URL(url);
    return ['http:', 'https:', 'mailto:'].includes(u.protocol);
  } catch { return false; }
}

function shortText(value, field, err) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') { err(`${field} debe ser texto`); return ''; }
  if (value.length > LIMITS.shortText) err(`${field} supera ${LIMITS.shortText} caracteres`);
  return value;
}

function spans(list, err) {
  if (!Array.isArray(list)) { err('content debe ser una lista de spans'); return []; }
  const out = [];
  list.forEach((s, i) => {
    if (!s || typeof s.text !== 'string') return err(`span ${i}: falta "text"`);
    if (s.text.length > LIMITS.textPerSpan) return err(`span ${i}: texto demasiado largo`);
    const marks = Array.isArray(s.marks) ? s.marks : [];
    const bad = marks.find(m => !ALLOWED_MARKS.includes(m));
    if (bad) return err(`span ${i}: formato "${bad}" no permitido`);
    if (s.href != null && !isSafeUrl(s.href)) return err(`span ${i}: enlace no válido`);

    const clean = { text: s.text, marks: [...new Set(marks)].sort() };
    if (s.href) clean.href = s.href;
    out.push(clean);
  });
  return normalizeSpans(out);
}

// Une spans vecinos con el mismo formato y quita los vacíos:
// [{text:"Ho"},{text:"la"}] -> [{text:"Hola"}]
function normalizeSpans(list) {
  const out = [];
  for (const s of list) {
    if (s.text === '') continue;
    const prev = out[out.length - 1];
    if (prev && prev.href === s.href && prev.marks.join() === s.marks.join()) prev.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

function newId() {
  return require('crypto').randomBytes(4).toString('hex');
}

// Bloques que quedaron vacíos no aportan nada: se eliminan
function isEmpty(b) {
  if (b.type === 'image') return false;
  if (b.type === 'list') return b.items.length === 0;
  if (b.type === 'accordion') return b.items.length === 0;
  return b.content.length === 0;
}

// ─── Validar una lista de bloques (el documento, o el interior de un contenedor) ───
//
// err:  función que registra un error (ya trae el prefijo de dónde estamos)
// ctx:  { seenIds, insideContainer }
function validateBlocks(list, err, ctx) {
  if (!Array.isArray(list)) { err('blocks debe ser una lista'); return []; }

  const blocks = [];
  list.forEach((b, i) => {
    const blockErr = msg => err(`bloque ${i + 1} (${b?.type ?? '?'}): ${msg}`);
    const validator = BLOCK_TYPES[b?.type];
    if (!validator) return blockErr('tipo de bloque desconocido');
    if (ctx.insideContainer && CONTAINER_TYPES.includes(b.type)) return blockErr('no se puede poner dentro de otro contenedor');

    // Copiamos SOLO los campos que el tipo declara; cualquier otro se descarta.
    const fields = validator(b, blockErr, ctx);

    // Los ids deben ser únicos en TODO el documento, también dentro de los acordeones
    let id = typeof b.id === 'string' && /^[a-z0-9]{4,16}$/i.test(b.id) ? b.id : newId();
    while (ctx.seenIds.has(id)) id = newId();
    ctx.seenIds.add(id);

    if (b.type === 'list') fields.items = fields.items.filter(it => it.length);
    const block = { id, type: b.type, ...fields };
    if (!isEmpty(block)) blocks.push(block);
  });
  return blocks;
}

// Cuenta todos los bloques, incluidos los que están dentro de contenedores
const countBlocks = (blocks) =>
  blocks.reduce((n, b) => n + 1 + (b.type === 'accordion' ? b.items.reduce((m, it) => m + countBlocks(it.blocks), 0) : 0), 0);

// ─── Punto de entrada ───

// Devuelve { ok: true, doc } con el documento limpio y normalizado,
// o { ok: false, errors: [...] } con mensajes legibles.
function validateDocument(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.blocks)) {
    return { ok: false, errors: ['El documento debe tener la forma { version, blocks: [...] }'] };
  }

  const errors = [];
  // El primer nivel usa "Bloque 3 (...)": con mayúscula para que el mensaje se lea bien
  const err = msg => errors.push(msg.charAt(0).toUpperCase() + msg.slice(1));
  const blocks = validateBlocks(input.blocks, err, { seenIds: new Set(), insideContainer: false });

  if (countBlocks(blocks) > LIMITS.blocks) errors.push(`Máximo ${LIMITS.blocks} bloques en total`);

  if (errors.length) return { ok: false, errors };
  return { ok: true, doc: { version: SCHEMA_VERSION, blocks } };
}

module.exports = {
  validateDocument, validateBlocks, countBlocks, newId, isSafeUrl,
  BLOCK_TYPES: Object.keys(BLOCK_TYPES), SCHEMA_VERSION, LIMITS,
};
