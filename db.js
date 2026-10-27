// db.js — Capa de base de datos
// Crea el archivo cms.db (SQLite) y las tablas si no existen.

const Database = require('better-sqlite3');
const db = new Database('cms.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    slug         TEXT NOT NULL UNIQUE,
    body         TEXT NOT NULL,              -- documento JSON: {"version":1,"blocks":[...]}
    excerpt      TEXT,
    status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
    published_at TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS revisions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id  INTEGER NOT NULL REFERENCES articles(id),
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,               -- misma forma que articles.body
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Páginas: inicio, "quiénes somos", landings... Misma idea que articles,
  -- pero su body tiene OTRA forma: {"version":1,"sections":[...]}.
  -- Tabla aparte (y no una columna "type" en articles) porque cada tipo tiene
  -- su propio esquema, sus propias rutas y, en el futuro, sus propios campos.
  CREATE TABLE IF NOT EXISTS pages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    slug         TEXT NOT NULL UNIQUE,
    body         TEXT NOT NULL,              -- documento JSON con secciones y columnas
    excerpt      TEXT,                       -- útil como meta description
    status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
    published_at TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS page_revisions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id     INTEGER NOT NULL REFERENCES pages(id),
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// SQLite entiende JSON: json_valid() devuelve 0 si el texto no es JSON.
// Si quedan artículos de la versión anterior (HTML), avisamos al arrancar.
const legacy = db.prepare(`SELECT COUNT(*) AS n FROM articles WHERE json_valid(body) = 0`).get().n;
if (legacy > 0 && !process.env.CMS_MIGRATING) {
  console.warn(`\n⚠  Hay ${legacy} artículo(s) guardados en HTML (formato anterior).`);
  console.warn('   Ejecuta  npm run migrar  para convertirlos a JSON.\n');
}

module.exports = db;
