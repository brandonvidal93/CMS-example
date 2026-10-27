// blocks/page-schema.js — El "contrato" de las PÁGINAS
//
// Una página es un árbol de tres niveles:
//
//   página ─┬─ sección (layout: "1/3+2/3", background: "light")
//           │    ├─ columna ── [bloques]
//           │    └─ columna ── [bloques]
//           └─ sección (layout: "1")
//                └─ columna ── [bloques]
//
// {
//   "version": 1,
//   "sections": [
//     { "id": "a1b2c3d4", "layout": "1/3+2/3", "background": "light",
//       "columns": [ { "blocks": [...] }, { "blocks": [...] } ] }
//   ]
// }
//
// Los bloques de las columnas son EXACTAMENTE los de los artículos: aquí no se
// redefine nada, se llama a validateBlocks() de schema.js.
//
// El diseño se guarda por INTENCIÓN ("1/3+2/3", "light"), no con valores
// literales ("33%", "#f5f5f5"). Cada cliente (web, app) decide cómo pintarlo.

const { validateBlocks, countBlocks, newId, LIMITS } = require('./schema');

// Layouts permitidos y cuántas columnas tiene cada uno.
// Añadir un layout nuevo = una línea aquí + su CSS en el tema.
const LAYOUTS = {
  '1':           1,
  '1/2+1/2':     2,
  '1/3+2/3':     2,
  '2/3+1/3':     2,
  '1/3+1/3+1/3': 3,
};

const BACKGROUNDS = ['none', 'light', 'accent'];
const MAX_SECTIONS = 50;

function validatePage(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.sections)) {
    return { ok: false, errors: ['La página debe tener la forma { version, sections: [...] }'] };
  }

  const errors = [];
  if (input.sections.length > MAX_SECTIONS) errors.push(`Máximo ${MAX_SECTIONS} secciones`);

  // Un solo conjunto de ids para TODA la página: secciones y bloques de todas las columnas
  const seenIds = new Set();
  const uniqueId = (candidate) => {
    let id = typeof candidate === 'string' && /^[a-z0-9]{4,16}$/i.test(candidate) ? candidate : newId();
    while (seenIds.has(id)) id = newId();
    seenIds.add(id);
    return id;
  };

  const sections = [];
  input.sections.forEach((s, i) => {
    const err = msg => errors.push(`Sección ${i + 1}: ${msg}`);
    if (!s || typeof s !== 'object') return err('formato no válido');

    // 1. El layout tiene que ser uno de la lista...
    const expected = LAYOUTS[s.layout];
    if (!expected) return err(`layout "${s.layout}" no permitido (usa: ${Object.keys(LAYOUTS).join(', ')})`);

    // 2. ...y el número de columnas tiene que coincidir con él
    if (!Array.isArray(s.columns) || s.columns.length !== expected) {
      return err(`el layout "${s.layout}" necesita ${expected} columna(s) y llegaron ${Array.isArray(s.columns) ? s.columns.length : 0}`);
    }

    const background = s.background ?? 'none';
    if (!BACKGROUNDS.includes(background)) err(`fondo "${background}" no permitido`);

    // 3. Cada columna contiene bloques normales. insideContainer: false porque una
    //    columna es ESTRUCTURA, no un bloque: dentro sí se permite un acordeón.
    //    Lo que nunca puede aparecer aquí es otra sección: no es un tipo de bloque,
    //    así que validateBlocks lo rechazaría como "tipo desconocido".
    const columns = s.columns.map((c, j) => ({
      blocks: validateBlocks(c?.blocks, msg => err(`columna ${j + 1}: ${msg}`), { seenIds, insideContainer: false }),
    }));

    // Una sección sin nada en ninguna columna no aporta: se descarta.
    // (Una columna vacía SÍ se permite: sirve de espacio en blanco en el diseño.)
    if (columns.every(c => c.blocks.length === 0)) return;

    sections.push({ id: uniqueId(s.id), layout: s.layout, background, columns });
  });

  const total = sections.reduce((n, s) => n + s.columns.reduce((m, c) => m + countBlocks(c.blocks), 0), 0);
  if (total > LIMITS.blocks) errors.push(`Máximo ${LIMITS.blocks} bloques en total`);

  if (errors.length) return { ok: false, errors };
  return { ok: true, doc: { version: 1, sections } };
}

module.exports = { validatePage, LAYOUTS, BACKGROUNDS };
