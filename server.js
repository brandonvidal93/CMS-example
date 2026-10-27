// server.js — El "backend" del CMS
// Ejecuta:  npm start   y abre http://localhost:3000/admin
//
// Hay dos TIPOS DE CONTENIDO:
//   - Artículos: una sola columna de bloques. Se ven en /blog/<slug>
//   - Páginas:   secciones con columnas, y bloques dentro.  Se ven en /<slug>
//
// Comparten casi todo (guardar, revisiones, slug, publicar), así que el código
// común se escribe una vez y cada tipo aporta solo lo que lo hace distinto.

const express = require('express');
const db = require('./db');
const views = require('./views');
const { validateDocument } = require('./blocks/schema');
const { validatePage } = require('./blocks/page-schema');
const { renderHtml } = require('./blocks/render-html');
const { renderMarkdown } = require('./blocks/render-markdown');
const { renderPageHtml, renderPageMarkdown } = require('./blocks/render-page');
const { makeExcerpt } = require('./blocks/plain-text');

const app = express();
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(express.static('public'));

// ─────────────────────────────────────────────
// Lo que hace distinto a cada tipo de contenido
// ─────────────────────────────────────────────

const TYPES = {
  articles: {
    label: 'artículo',
    table: 'articles',
    revisions: 'revisions', revisionFk: 'article_id',
    validate: validateDocument,
    emptyDoc: () => ({ version: 1, blocks: [] }),
    publicUrl: (slug) => `/blog/${slug}`,
    reservedSlugs: [],
  },
  pages: {
    label: 'página',
    table: 'pages',
    revisions: 'page_revisions', revisionFk: 'page_id',
    validate: validatePage,
    emptyDoc: () => ({ version: 1, sections: [] }),
    publicUrl: (slug) => `/${slug}`,
    // Las páginas viven en la raíz (/quienes-somos), así que no pueden llamarse
    // como las rutas que ya existen: /admin/quienes-somos no es una página.
    reservedSlugs: ['admin', 'api', 'blog', 'editor.js'],
  },
};

// /admin/:type/...  -> si :type no es "articles" ni "pages", 404
app.param('type', (req, res, next, type) => {
  if (!TYPES[type]) return res.status(404).send('Tipo de contenido desconocido');
  req.cfg = TYPES[type];
  req.type = type;
  next();
});

// ─────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────

function slugify(text) {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sin-titulo';
}

// El slug debe ser único DENTRO de su tabla y no chocar con rutas reservadas
function uniqueSlug(cfg, base, currentId) {
  let slug = base, n = 2;
  const exists = db.prepare(`SELECT id FROM ${cfg.table} WHERE slug = ? AND id != ?`);
  while (cfg.reservedSlugs.includes(slug) || exists.get(slug, currentId ?? -1)) slug = `${base}-${n++}`;
  return slug;
}

function loadDoc(row) {
  try { return JSON.parse(row.body); }
  catch { return null; } // contenido en formato antiguo (HTML) sin migrar
}

// Páginas publicadas para el menú de la cabecera
const navPages = () =>
  db.prepare(`SELECT title, slug FROM pages WHERE status = 'published' ORDER BY created_at`).all();

const getPublished = (cfg, slug) =>
  db.prepare(`SELECT * FROM ${cfg.table} WHERE slug = ? AND status = 'published'`).get(slug);

// ─────────────────────────────────────────────
// PANEL DE ADMINISTRACIÓN
// ─────────────────────────────────────────────

app.get('/admin', (req, res) => {
  const list = (table) => db.prepare(`SELECT id, title, slug, status, updated_at FROM ${table} ORDER BY updated_at DESC`).all();
  res.send(views.adminList({ articles: list('articles'), pages: list('pages') }));
});

// Dirección antigua de la versión anterior: /admin/edit/5 -> /admin/articles/5
app.get('/admin/edit/:id', (req, res) => res.redirect(301, `/admin/articles/${req.params.id}`));

app.get('/admin/:type/new', (req, res) => {
  res.send(views.editor({ kind: req.type, doc: req.cfg.emptyDoc() }));
});

app.get('/admin/:type/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM ${req.cfg.table} WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).send('No existe');
  const doc = loadDoc(row);
  if (!doc) return res.status(409).send('Este contenido está en HTML. Ejecuta "npm run migrar" y vuelve a intentarlo.');
  res.send(views.editor({ ...row, kind: req.type, doc, saved: req.query.ok === '1' }));
});

// GUARDAR — el mismo flujo para artículos y páginas; solo cambia cfg.validate y la tabla
app.post('/admin/:type/save', (req, res) => {
  const { cfg } = req;
  const id = req.body.id ? Number(req.body.id) : null;
  const title = (req.body.title || '').trim();
  const status = req.body.action === 'publish' ? 'published' : 'draft';
  const current = id ? db.prepare(`SELECT status, slug FROM ${cfg.table} WHERE id = ?`).get(id) : null;
  if (id && !current) return res.status(404).send('No existe');

  // 1. Leer el JSON que mandó el editor
  let input;
  try { input = JSON.parse(req.body.content || ''); }
  catch { input = null; }

  // 2. Validar título + documento con el esquema de ESTE tipo
  const errors = [];
  if (!title) errors.push('El título es obligatorio');
  if (title.length > 200) errors.push('El título es demasiado largo');
  const result = input ? cfg.validate(input) : { ok: false, errors: ['El contenido no es JSON válido'] };
  if (!result.ok) errors.push(...result.errors);

  if (errors.length) {
    const looksRight = input && typeof input === 'object' && Array.isArray(cfg.emptyDoc().blocks ? input.blocks : input.sections);
    return res.status(422).send(views.editor({
      kind: req.type, id, title, errors, status: current?.status, slug: current?.slug,
      doc: looksRight ? input : cfg.emptyDoc(), // devolvemos lo escrito para no perderlo
    }));
  }
  const doc = result.doc;

  // 3. Campos derivados
  const slug = uniqueSlug(cfg, slugify(title), id);
  const excerpt = makeExcerpt(doc);
  const body = JSON.stringify(doc);

  // 4. Guardar en una transacción
  const save = db.transaction(() => {
    if (id) {
      db.prepare(`INSERT INTO ${cfg.revisions} (${cfg.revisionFk}, title, body)
                  SELECT id, title, body FROM ${cfg.table} WHERE id = ?`).run(id);
      db.prepare(`UPDATE ${cfg.table}
                     SET title = ?, slug = ?, body = ?, excerpt = ?, status = ?,
                         published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, datetime('now')) ELSE published_at END,
                         updated_at = datetime('now')
                   WHERE id = ?`)
        .run(title, slug, body, excerpt, status, status, id);
      return id;
    }
    return db.prepare(`INSERT INTO ${cfg.table} (title, slug, body, excerpt, status, published_at)
                       VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN datetime('now') END)`)
      .run(title, slug, body, excerpt, status, status).lastInsertRowid;
  });
  const savedId = save();

  // 5. Efectos secundarios
  console.log(`[guardado] ${cfg.label} ${savedId} -> ${status} -> ${cfg.publicUrl(slug)}`);

  // 6. Responder
  res.redirect(`/admin/${req.type}/${savedId}?ok=1`);
});

// ─────────────────────────────────────────────
// API pública — para una app móvil u otro frontend
// ─────────────────────────────────────────────

app.get('/api/:type', (req, res) => {
  const rows = db.prepare(`SELECT title, slug, excerpt, published_at FROM ${req.cfg.table}
                           WHERE status = 'published' ORDER BY published_at DESC`).all();
  res.json({ data: rows });
});

app.get('/api/:type/:slug', (req, res) => {
  const row = getPublished(req.cfg, req.params.slug);
  const doc = row && loadDoc(row);
  if (!doc) return res.status(404).json({ error: 'not_found' });
  const { title, slug, excerpt, published_at, updated_at } = row;
  res.json({ data: { type: req.type, title, slug, excerpt, published_at, updated_at, content: doc } });
});

app.get('/api/:type/:slug/markdown', (req, res) => {
  const row = getPublished(req.cfg, req.params.slug);
  const doc = row && loadDoc(row);
  if (!doc) return res.status(404).type('text/plain').send('No encontrado');
  const md = req.type === 'pages' ? renderPageMarkdown(row.title, doc) : renderMarkdown(row.title, doc);
  res.type('text/markdown; charset=utf-8').send(md);
});

// ─────────────────────────────────────────────
// SITIO PÚBLICO
// ─────────────────────────────────────────────

app.get('/', (req, res) => {
  const articles = db.prepare(`SELECT title, slug, excerpt, published_at FROM articles
                               WHERE status = 'published' ORDER BY published_at DESC`).all();
  res.send(views.publicHome(articles, navPages()));
});

app.get('/blog/:slug', (req, res) => {
  const row = getPublished(TYPES.articles, req.params.slug);
  const doc = row && loadDoc(row);
  if (!doc) return res.status(404).send(views.notFound(navPages()));
  res.send(views.publicArticle(row, renderHtml(doc), navPages()));
});

// Páginas en la raíz. Va AL FINAL: Express prueba las rutas en orden, así que
// /admin, /api y /blog ya se resolvieron antes de llegar aquí.
app.get('/:slug', (req, res) => {
  const row = getPublished(TYPES.pages, req.params.slug);
  const doc = row && loadDoc(row);
  if (!doc) return res.status(404).send(views.notFound(navPages()));
  res.send(views.publicPage(row, renderPageHtml(doc), navPages()));
});

app.listen(3000, () => console.log('Mini CMS en http://localhost:3000  (panel: /admin, API: /api/articles y /api/pages)'));
