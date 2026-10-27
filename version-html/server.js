// server.js — El "backend" del CMS
// Ejecuta:  node server.js   y abre http://localhost:3000

const express = require('express');
const sanitizeHtml = require('sanitize-html');
const db = require('./db');
const views = require('./views');

const app = express();
app.use(express.urlencoded({ extended: false })); // lee formularios enviados por POST

// ─────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────

// "Mi Primer Artículo!" -> "mi-primer-articulo"
function slugify(text) {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Si el slug ya existe en OTRO artículo, añade -2, -3...
function uniqueSlug(base, currentId) {
  let slug = base, n = 2;
  const exists = db.prepare('SELECT id FROM articles WHERE slug = ? AND id != ?');
  while (exists.get(slug, currentId ?? -1)) slug = `${base}-${n++}`;
  return slug;
}

// Lista blanca: solo estas etiquetas y atributos sobreviven
function cleanHtml(dirty) {
  return sanitizeHtml(dirty, {
    allowedTags: ['h2', 'h3', 'p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a', 'blockquote'],
    allowedAttributes: { a: ['href'] },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}

// Primeras ~160 letras del texto sin etiquetas
function makeExcerpt(html) {
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();
  return text.length > 160 ? text.slice(0, 157) + '...' : text;
}

// ─────────────────────────────────────────────
// PANEL DE ADMINISTRACIÓN (escritura)
// ─────────────────────────────────────────────

// Lista de todos los artículos, borradores incluidos
app.get('/admin', (req, res) => {
  const articles = db.prepare('SELECT id, title, slug, status, updated_at FROM articles ORDER BY updated_at DESC').all();
  res.send(views.adminList(articles));
});

// Editor vacío (nuevo) o con datos (editar)
app.get('/admin/new', (req, res) => res.send(views.editor({})));
app.get('/admin/edit/:id', (req, res) => {
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!article) return res.status(404).send('No existe');
  res.send(views.editor(article));
});

// GUARDAR: aquí ocurre todo lo que vimos en la teoría
app.post('/admin/save', (req, res) => {
  const id = req.body.id ? Number(req.body.id) : null;
  const title = (req.body.title || '').trim();
  const status = req.body.action === 'publish' ? 'published' : 'draft';

  // 1. Validar
  if (!title) return res.status(422).send(views.editor({ ...req.body, error: 'El título es obligatorio' }));
  if (title.length > 200) return res.status(422).send(views.editor({ ...req.body, error: 'Título demasiado largo' }));

  // 2. Sanitizar el HTML que mandó el editor
  const body = cleanHtml(req.body.body || '');

  // 3. Campos derivados
  const slug = uniqueSlug(slugify(title), id);
  const excerpt = makeExcerpt(body);

  // 4. Guardar en una transacción: o se hace todo, o nada
  const save = db.transaction(() => {
    if (id) {
      // Antes de sobrescribir, guardamos la versión anterior
      db.prepare(`INSERT INTO revisions (article_id, title, body)
                  SELECT id, title, body FROM articles WHERE id = ?`).run(id);

      db.prepare(`UPDATE articles
                     SET title = ?, slug = ?, body = ?, excerpt = ?, status = ?,
                         published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, datetime('now')) ELSE published_at END,
                         updated_at = datetime('now')
                   WHERE id = ?`)
        .run(title, slug, body, excerpt, status, status, id);
      return id;
    } else {
      const info = db.prepare(`INSERT INTO articles (title, slug, body, excerpt, status, published_at)
                               VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN datetime('now') END)`)
        .run(title, slug, body, excerpt, status, status);
      return info.lastInsertRowid;
    }
  });
  const savedId = save();

  // 5. Efectos secundarios (en un CMS real: limpiar caché, webhooks, buscador...)
  console.log(`[guardado] artículo ${savedId} -> ${status} -> /blog/${slug}`);

  // 6. Responder: volvemos al editor
  res.redirect(`/admin/edit/${savedId}?ok=1`);
});

// ─────────────────────────────────────────────
// SITIO PÚBLICO (lectura)
// ─────────────────────────────────────────────

// Portada: solo artículos publicados
app.get('/', (req, res) => {
  const articles = db.prepare(`SELECT title, slug, excerpt, published_at FROM articles
                               WHERE status = 'published' ORDER BY published_at DESC`).all();
  res.send(views.publicHome(articles));
});

// Un artículo: el router extrae el slug de la URL y lo busca
app.get('/blog/:slug', (req, res) => {
  const article = db.prepare(`SELECT * FROM articles WHERE slug = ? AND status = 'published'`).get(req.params.slug);
  if (!article) return res.status(404).send(views.notFound());
  res.send(views.publicArticle(article));
});

app.listen(3000, () => console.log('Mini CMS en http://localhost:3000  (panel: /admin)'));
