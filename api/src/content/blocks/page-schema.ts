// page-schema.ts — El "contrato" de las PÁGINAS (versión TypeScript de blocks/page-schema.js)
//
//   página ─┬─ sección (layout, background)
//           │    ├─ columna ── [bloques]   <- validateBlocks() de schema.ts
//           │    └─ columna ── [bloques]
//           └─ ...

import type { Background, Layout, PageDoc, Section } from './types.js';
import { countBlocks, type ErrFn, LIMITS, newId, validateBlocks, type ValidationResult } from './schema.js';

// Layouts permitidos y cuántas columnas tiene cada uno
export const LAYOUTS: Record<Layout, number> = {
  '1': 1,
  '1/2+1/2': 2,
  '1/3+2/3': 2,
  '2/3+1/3': 2,
  '1/3+1/3+1/3': 3,
};
export const BACKGROUNDS: Background[] = ['none', 'light', 'accent'];
const MAX_SECTIONS = 50;

type Raw = Record<string, any>;
const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);

export function validatePage(input: unknown): ValidationResult<PageDoc> {
  if (!isObj(input) || !Array.isArray(input['sections'])) {
    return { ok: false, errors: ['La página debe tener la forma { version, sections: [...] }'] };
  }

  const errors: string[] = [];
  const raw: unknown[] = input['sections'];
  if (raw.length > MAX_SECTIONS) errors.push(`Máximo ${MAX_SECTIONS} secciones`);

  const seenIds = new Set<string>();
  const uniqueId = (candidate: unknown) => {
    let id = typeof candidate === 'string' && /^[a-z0-9]{4,16}$/i.test(candidate) ? candidate : newId();
    while (seenIds.has(id)) id = newId();
    seenIds.add(id);
    return id;
  };

  const sections: Section[] = [];
  raw.forEach((s, i) => {
    const err: ErrFn = msg => errors.push(`Sección ${i + 1}: ${msg}`);
    if (!isObj(s)) return err('formato no válido');

    const layout = s['layout'] as Layout;
    const expected = LAYOUTS[layout];
    if (!expected) return err(`layout "${String(layout)}" no permitido (usa: ${Object.keys(LAYOUTS).join(', ')})`);

    const cols: unknown[] = Array.isArray(s['columns']) ? s['columns'] : [];
    if (cols.length !== expected) {
      return err(`el layout "${layout}" necesita ${expected} columna(s) y llegaron ${cols.length}`);
    }

    const background = (s['background'] ?? 'none') as Background;
    if (!BACKGROUNDS.includes(background)) err(`fondo "${String(background)}" no permitido`);

    // Una columna es estructura, no un bloque: dentro SÍ se permite un acordeón
    const columns = cols.map((c, j) => ({
      blocks: validateBlocks(isObj(c) ? c['blocks'] : undefined, msg => err(`columna ${j + 1}: ${msg}`), { seenIds, insideContainer: false }),
    }));

    if (columns.every(c => c.blocks.length === 0)) return; // sección vacía: se descarta
    sections.push({ id: uniqueId(s['id']), layout, background, columns });
  });

  const total = sections.reduce((n, s) => n + s.columns.reduce((m, c) => m + countBlocks(c.blocks), 0), 0);
  if (total > LIMITS.blocks) errors.push(`Máximo ${LIMITS.blocks} bloques en total`);

  return errors.length ? { ok: false, errors } : { ok: true, doc: { version: 1, sections } };
}
