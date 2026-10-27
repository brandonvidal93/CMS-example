// migrar-html-a-json.js — Convierte los artículos guardados en HTML a bloques JSON
// Ejecuta:  npm run migrar
//
// Es lo que harías en un proyecto real al cambiar el formato del contenido:
// 1. respaldar la base, 2. leer cada fila vieja, 3. transformarla,
// 4. validarla con el MISMO esquema que usa el editor, 5. guardarla.
// Si algo falla, no se cambia nada (transacción).

const fs = require('fs');
const Database = require('better-sqlite3');
const { parseDocument } = require('htmlparser2');

if (!fs.existsSync('cms.db')) { console.log('No hay cms.db: nada que migrar.'); process.exit(0); }

// ¿Hay algo que migrar? Lo miramos en modo solo lectura
const peek = new Database('cms.db', { readonly: true });
const pending = peek.prepare(`SELECT COUNT(*) AS n FROM articles WHERE json_valid(body) = 0`).get().n
              + peek.prepare(`SELECT COUNT(*) AS n FROM revisions WHERE json_valid(body) = 0`).get().n;
peek.close();
if (pending === 0) { console.log('Todo está ya en JSON: nada que migrar.'); process.exit(0); }

// 1. Respaldo antes de tocar nada
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = `cms.backup-${stamp}.db`;
fs.copyFileSync('cms.db', backup);
console.log(`Respaldo creado: ${backup}`);

process.env.CMS_MIGRATING = '1'; // que db.js no muestre el aviso de "ejecuta npm run migrar"
const db = require('./db');
const { validateDocument } = require('./blocks/schema');
const { makeExcerpt } = require('./blocks/plain-text');

// ─── HTML -> spans (texto con formato) ───
function nodesToSpans(nodes) {
  const out = [];
  (function walk(list, marks, href) {
    for (const n of list) {
      if (n.type === 'text') { out.push({ text: n.data.replace(/\s+/g, ' '), marks: [...marks].sort(), ...(href && { href }) }); continue; }
      if (n.type !== 'tag') continue;
      if (n.name === 'br') { out.push({ text: '\n', marks: [...marks].sort(), ...(href && { href }) }); continue; }
      const m = new Set(marks);
      if (['b', 'strong'].includes(n.name)) m.add('bold');
      if (['i', 'em'].includes(n.name)) m.add('italic');
      walk(n.children, m, n.name === 'a' ? n.attribs.href : href);
    }
  })(nodes, new Set(), null);
  // quitar espacios sobrantes al principio y al final
  if (out.length) { out[0].text = out[0].text.trimStart(); out[out.length - 1].text = out[out.length - 1].text.trimEnd(); }
  return out;
}

// ─── HTML -> bloques ───
const INLINE = ['b', 'strong', 'i', 'em', 'a', 'br', 'span', 'u', 'code', 'small', 'mark', 'sub', 'sup'];

function htmlToBlocks(html) {
  const blocks = [];
  (function walk(nodes) {
    // Texto suelto y etiquetas en línea seguidas (ej. "hola<br><b>mundo</b>")
    // se juntan en UN párrafo, en vez de un párrafo por pieza
    let inline = [];
    const flush = () => {
      if (inline.some(n => n.type === 'tag' || n.data.trim())) blocks.push({ type: 'paragraph', content: nodesToSpans(inline) });
      inline = [];
    };

    for (const n of nodes) {
      if (n.type === 'text' || (n.type === 'tag' && INLINE.includes(n.name))) { inline.push(n); continue; }
      if (n.type !== 'tag') continue;
      flush();
      switch (n.name) {
        case 'h1': case 'h2': blocks.push({ type: 'heading', level: 2, content: nodesToSpans(n.children) }); break;
        case 'h3': case 'h4': case 'h5': case 'h6': blocks.push({ type: 'heading', level: 3, content: nodesToSpans(n.children) }); break;
        case 'p': blocks.push({ type: 'paragraph', content: nodesToSpans(n.children) }); break;
        case 'blockquote': blocks.push({ type: 'quote', content: nodesToSpans(n.children) }); break;
        case 'ul': case 'ol':
          blocks.push({
            type: 'list', style: n.name === 'ol' ? 'number' : 'bullet',
            items: n.children.filter(c => c.name === 'li').map(li => nodesToSpans(li.children)),
          });
          break;
        case 'img': blocks.push({ type: 'image', url: n.attribs.src, alt: n.attribs.alt || '', caption: '' }); break;
        case 'div': case 'section': case 'article': walk(n.children); break; // contenedores: mirar dentro
        default: blocks.push({ type: 'paragraph', content: nodesToSpans([n]) }); // cualquier otra cosa: como párrafo
      }
    }
    flush();
  })(parseDocument(html).children);
  return { version: 1, blocks };
}

function convert(html, label) {
  const result = validateDocument(htmlToBlocks(html));
  if (!result.ok) throw new Error(`${label}: ${result.errors.join('; ')}`);
  return result.doc;
}

// 2-5. Migrar artículos y revisiones dentro de una transacción
const migrate = db.transaction(() => {
  let articles = 0, revisions = 0;

  for (const a of db.prepare(`SELECT id, title, body FROM articles WHERE json_valid(body) = 0`).all()) {
    const doc = convert(a.body, `Artículo ${a.id}`);
    db.prepare(`UPDATE articles SET body = ?, excerpt = ? WHERE id = ?`).run(JSON.stringify(doc), makeExcerpt(doc), a.id);
    console.log(`  ✓ Artículo ${a.id} "${a.title}": ${doc.blocks.length} bloques`);
    articles++;
  }
  for (const r of db.prepare(`SELECT id, body FROM revisions WHERE json_valid(body) = 0`).all()) {
    db.prepare(`UPDATE revisions SET body = ? WHERE id = ?`).run(JSON.stringify(convert(r.body, `Revisión ${r.id}`)), r.id);
    revisions++;
  }
  return { articles, revisions };
});

try {
  const { articles, revisions } = migrate();
  console.log(`\nListo: ${articles} artículo(s) y ${revisions} revisión(es) convertidos.`);
} catch (e) {
  console.error(`\nNo se migró nada. Error: ${e.message}`);
  process.exit(1);
}
