// schema.ts — El "contrato" de los bloques (versión TypeScript de blocks/schema.js)
//
// Misma idea que antes: todo lo que entra pasa por aquí y SOLO sobrevive lo que
// está declarado. La diferencia es el tipado:
//   - la entrada es `unknown`: viene del navegador, no confiamos en ella
//   - la salida es `Block[]`: el resto del código puede confiar en su forma

import { randomBytes } from 'node:crypto';
import type { AccordionItem, ArticleDoc, Block, BlockType, Mark, Span } from './types.js';

export const LIMITS = { blocks: 500, listItems: 200, textPerSpan: 20000, url: 2000, shortText: 300, accordionItems: 30 };
const ALLOWED_MARKS: Mark[] = ['bold', 'italic'];
const CONTAINER_TYPES: BlockType[] = ['accordion'];

export type ErrFn = (msg: string) => void;
export interface Ctx { seenIds: Set<string>; insideContainer: boolean }
export type ValidationResult<T> = { ok: true; doc: T } | { ok: false; errors: string[] };

// "any" controlado: leemos campos de un objeto que aún no sabemos si tiene esa forma
type Raw = Record<string, any>;
const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);

export const newId = () => randomBytes(4).toString('hex');

export function isSafeUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > LIMITS.url) return false;
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function shortText(value: unknown, field: string, err: ErrFn): string {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') { err(`${field} debe ser texto`); return ''; }
  if (value.length > LIMITS.shortText) err(`${field} supera ${LIMITS.shortText} caracteres`);
  return value;
}

function spans(list: unknown, err: ErrFn): Span[] {
  if (!Array.isArray(list)) { err('content debe ser una lista de spans'); return []; }
  const out: Span[] = [];
  list.forEach((s, i) => {
    if (!isObj(s) || typeof s['text'] !== 'string') return err(`span ${i}: falta "text"`);
    if (s['text'].length > LIMITS.textPerSpan) return err(`span ${i}: texto demasiado largo`);
    const marks: unknown[] = Array.isArray(s['marks']) ? s['marks'] : [];
    const bad = marks.find(m => !ALLOWED_MARKS.includes(m as Mark));
    if (bad !== undefined) return err(`span ${i}: formato "${String(bad)}" no permitido`);
    if (s['href'] != null && !isSafeUrl(s['href'])) return err(`span ${i}: enlace no válido`);

    const clean: Span = { text: s['text'], marks: [...new Set(marks as Mark[])].sort() };
    if (s['href']) clean.href = s['href'];
    out.push(clean);
  });
  return normalizeSpans(out);
}

// Une spans vecinos con el mismo formato y quita los vacíos
function normalizeSpans(list: Span[]): Span[] {
  const out: Span[] = [];
  for (const s of list) {
    if (s.text === '') continue;
    const prev = out[out.length - 1];
    if (prev && prev.href === s.href && prev.marks.join() === s.marks.join()) prev.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

// ─── Un validador por tipo de bloque ───
// Cada uno recibe el bloque crudo y devuelve SOLO sus campos válidos (sin id ni type).
type Validator = (b: Raw, err: ErrFn, ctx: Ctx) => Record<string, unknown>;

const BLOCK_TYPES: Record<BlockType, Validator> = {
  paragraph: (b, err) => ({ content: spans(b['content'], err) }),

  heading: (b, err) => {
    if (![2, 3].includes(b['level'])) err('level debe ser 2 o 3');
    return { level: b['level'], content: spans(b['content'], err) };
  },

  quote: (b, err) => ({ content: spans(b['content'], err) }),

  list: (b, err) => {
    if (!['bullet', 'number'].includes(b['style'])) err('style debe ser "bullet" o "number"');
    const raw: unknown[] = Array.isArray(b['items']) ? b['items'] : [];
    if (raw.length === 0) err('items debe ser una lista con al menos un elemento');
    if (raw.length > LIMITS.listItems) err(`máximo ${LIMITS.listItems} elementos`);
    return { style: b['style'], items: raw.map((it, i) => spans(it, m => err(`items[${i}]: ${m}`))).filter(it => it.length) };
  },

  image: (b, err) => {
    if (!isSafeUrl(b['url'])) err('url debe empezar por http:// o https://');
    return { url: b['url'], alt: shortText(b['alt'], 'alt', err), caption: shortText(b['caption'], 'caption', err) };
  },

  callout: (b, err) => {
    if (!['info', 'warning'].includes(b['tone'])) err('tone debe ser "info" o "warning"');
    return { tone: b['tone'], content: spans(b['content'], err) };
  },

  // Contenedor: dentro de cada elemento hay otra lista de bloques -> recursión
  accordion: (b, err, ctx) => {
    if (!Array.isArray(b['items'])) { err('items debe ser una lista'); return { items: [] }; }
    if (b['items'].length > LIMITS.accordionItems) err(`máximo ${LIMITS.accordionItems} elementos`);

    const items: AccordionItem[] = [];
    b['items'].forEach((item: unknown, i: number) => {
      let innerErrors = 0;
      const itemErr: ErrFn = msg => { innerErrors++; err(`elemento ${i + 1}: ${msg}`); };
      if (!isObj(item)) return itemErr('formato no válido');

      const title = shortText(item['title'], 'title', itemErr).trim();
      const blocks = validateBlocks(item['blocks'], itemErr, { ...ctx, insideContainer: true });
      if (innerErrors) return;

      if (!title && blocks.length === 0) return;
      if (!title) return itemErr('falta el título');
      if (blocks.length === 0) return itemErr(`"${title}" no tiene contenido`);
      items.push({ title, blocks });
    });
    return { items };
  },
};

export const BLOCK_TYPE_NAMES = Object.keys(BLOCK_TYPES) as BlockType[];

function isEmpty(b: Block): boolean {
  switch (b.type) {
    case 'image': return false;
    case 'list':
    case 'accordion': return b.items.length === 0;
    default: return b.content.length === 0;
  }
}

// ─── Validar una lista de bloques (artículo, interior de acordeón o columna de página) ───
export function validateBlocks(list: unknown, err: ErrFn, ctx: Ctx): Block[] {
  if (!Array.isArray(list)) { err('blocks debe ser una lista'); return []; }

  const blocks: Block[] = [];
  list.forEach((b, i) => {
    const type = isObj(b) ? b['type'] : undefined;
    const blockErr: ErrFn = msg => err(`bloque ${i + 1} (${type ?? '?'}): ${msg}`);
    if (!isObj(b) || !(type in BLOCK_TYPES)) return blockErr('tipo de bloque desconocido');
    if (ctx.insideContainer && CONTAINER_TYPES.includes(type)) return blockErr('no se puede poner dentro de otro contenedor');

    const fields = BLOCK_TYPES[type as BlockType](b, blockErr, ctx);

    let id = typeof b['id'] === 'string' && /^[a-z0-9]{4,16}$/i.test(b['id']) ? b['id'] : newId();
    while (ctx.seenIds.has(id)) id = newId();
    ctx.seenIds.add(id);

    // Este "as Block" es seguro solo porque el validador del tipo ya comprobó cada campo
    const block = { id, type, ...fields } as Block;
    if (!isEmpty(block)) blocks.push(block);
  });
  return blocks;
}

export const countBlocks = (blocks: Block[]): number =>
  blocks.reduce((n, b) => n + 1 + (b.type === 'accordion' ? b.items.reduce((m, it) => m + countBlocks(it.blocks), 0) : 0), 0);

// ─── Punto de entrada para ARTÍCULOS ───
export function validateArticle(input: unknown): ValidationResult<ArticleDoc> {
  if (!isObj(input) || !Array.isArray(input['blocks'])) {
    return { ok: false, errors: ['El documento debe tener la forma { version, blocks: [...] }'] };
  }
  const errors: string[] = [];
  const err: ErrFn = msg => errors.push(msg.charAt(0).toUpperCase() + msg.slice(1));
  const blocks = validateBlocks(input['blocks'], err, { seenIds: new Set(), insideContainer: false });
  if (countBlocks(blocks) > LIMITS.blocks) errors.push(`Máximo ${LIMITS.blocks} bloques en total`);

  return errors.length ? { ok: false, errors } : { ok: true, doc: { version: 1, blocks } };
}
