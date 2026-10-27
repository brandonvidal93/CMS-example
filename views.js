// views.js — Las "plantillas" (el tema)
// Cada función recibe datos y devuelve HTML. El contenido de los artículos
// llega aquí ya convertido de JSON a HTML por blocks/render-html.js.

const { esc } = require('./blocks/render-html');

// Mete un objeto JSON dentro de un <script> sin riesgo: si el texto del
// artículo contuviera "</script>", cerraría la etiqueta antes de tiempo.
// Escapar "<" como < lo evita, y JSON.parse lo lee igual.
const safeJson = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

// ── Layout del sitio público: cabecera + contenido + pie ──
//
// opts.nav:  páginas publicadas para el menú [{ title, slug }]
// opts.wide: true en las páginas (más anchas que un artículo, que es para leer)
const publicLayout = (title, content, opts = {}) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${opts.description ? `<meta name="description" content="${esc(opts.description)}">` : ''}
<style>
  body { font-family: Georgia, serif; margin: 0; color: #b33b3b; line-height: 1.7; }
  .wrap { max-width: 680px; margin: 0 auto; padding: 0 16px; }
  .wide .wrap, .section-inner { max-width: 1040px; margin: 0 auto; padding: 0 16px; }
  header { padding: 24px 0; }
  header .wrap { display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: baseline; }
  header a { color: #6e1717; text-decoration: none; font-weight: bold; }
  header nav { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 15px; }
  header nav a { font-weight: normal; }
  .meta { color: #777; font-size: 14px; }

  /* Estilos del contenido: se aplican igual en un artículo que en una columna de página */
  .content h2 { margin-top: 1.6em; }
  .content > :first-child { margin-top: 0; }
  .content blockquote { border-left: 3px solid #6e1717; margin: 1em 0; padding-left: 16px; font-style: italic; }
  .content figure { margin: 1.5em 0; } .content img { max-width: 100%; height: auto; }
  .content figcaption { color: #777; font-size: 14px; }

  /* ── Secciones de las páginas ──
     El dato dice "1/3+2/3"; aquí decidimos qué significa visualmente. */
  .section { padding: 48px 0; }
  .bg-light  { background: #fbf3f3; }
  .bg-accent { background: #6e1717; color: #fdf2f2; }
  .bg-accent a, .bg-accent .accordion summary { color: #fff; }
  .section-inner { display: grid; gap: 32px; }
  .layout-1                { grid-template-columns: minmax(0, 760px); } /* una columna: ancho de lectura, alineada con el título */
  .layout-half-half        { grid-template-columns: 1fr 1fr; }
  .layout-third-twothirds  { grid-template-columns: 1fr 2fr; }
  .layout-twothirds-third  { grid-template-columns: 2fr 1fr; }
  .layout-thirds           { grid-template-columns: 1fr 1fr 1fr; }
  .column { min-width: 0; }  /* evita que una imagen grande desborde la columna */
  /* En pantallas estrechas, todas las columnas se apilan: el dato no cambia, solo cómo se pinta */
  @media (max-width: 760px) {
    .section-inner { grid-template-columns: 1fr; gap: 16px; }
    .section { padding: 32px 0; }
  }
  .page-title { margin: 0 0 8px; }
  .callout { padding: 12px 16px; border-radius: 6px; margin: 1em 0; }
  .callout-info { background: #eef4fb; color: #1d3f63; }
  .callout-warning { background: #fdf3e1; color: #6b4500; }
  .accordion { border: 1px solid #e6c9c9; border-radius: 8px; margin: 1.5em 0; }
  .accordion details + details { border-top: 1px solid #e6c9c9; }
  .accordion summary { cursor: pointer; padding: 12px 16px; font-weight: bold; color: #6e1717; list-style: none; display: flex; justify-content: space-between; }
  .accordion summary::-webkit-details-marker { display: none; }
  .accordion summary::after { content: '+'; font-weight: normal; }
  .accordion details[open] summary::after { content: '−'; }
  .accordion summary:focus-visible { outline: 2px solid #6e1717; outline-offset: -2px; }
  .accordion-body { padding: 0 16px 8px; }
  .accordion-body > :first-child { margin-top: 0; }
  footer { margin-top: 48px; padding: 24px 0; color: #999; font-size: 13px; }
</style></head>
<body class="${opts.wide ? 'wide' : ''}">
  <header><div class="wrap">
    <a href="/">Mi Blog</a>
    ${opts.nav?.length ? `<nav>${opts.nav.map(p => `<a href="/${esc(p.slug)}">${esc(p.title)}</a>`).join('')}</nav>` : ''}
  </div></header>
  ${content}
  <footer><div class="wrap">Hecho con Mini CMS</div></footer>
</body></html>`;

exports.publicHome = (articles, nav) => publicLayout('Mi Blog', `<main class="wrap">
  <h1>Últimos artículos</h1>
  ${articles.length === 0 ? '<p>Todavía no hay artículos publicados.</p>' : ''}
  ${articles.map(a => `
    <section>
      <h2><a href="/blog/${esc(a.slug)}">${esc(a.title)}</a></h2>
      <p class="meta">${esc(a.published_at)}</p>
      <p>${esc(a.excerpt)}</p>
    </section>`).join('')}
</main>`, { nav });

// bodyHtml lo generó render-html.js a partir del JSON: todo su texto ya va escapado.
exports.publicArticle = (a, bodyHtml, nav) => publicLayout(a.title, `<main class="wrap">
  <article class="content">
    <h1>${esc(a.title)}</h1>
    <p class="meta">Publicado el ${esc(a.published_at)}</p>
    ${bodyHtml}
  </article>
</main>`, { nav, description: a.excerpt });

// Una página: sin fecha ni "publicado el" (no es una noticia), y a lo ancho.
// El título se muestra arriba; el resto son las secciones que diseñó el editor.
exports.publicPage = (p, sectionsHtml, nav) => publicLayout(p.title, `<main>
  <div class="wrap"><h1 class="page-title">${esc(p.title)}</h1></div>
  ${sectionsHtml}
</main>`, { nav, wide: true, description: p.excerpt });

exports.notFound = (nav) => publicLayout('No encontrado', '<main class="wrap"><h1>404</h1><p>Esta página no existe o no está publicada.</p></main>', { nav });

// ── Panel de administración ──
const adminLayout = (content, opts = {}) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 860px; margin: 0 auto; padding: 24px 16px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
  .badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; }
  .draft { background: #eee; } .published { background: #d4f5d4; }
  input[type=text].title { width: 100%; font-size: 22px; padding: 8px; box-sizing: border-box; }
  .toolbar { position: sticky; top: 0; background: #fff; padding: 8px 0; z-index: 1; border-bottom: 1px solid #eee; }
  .toolbar button { margin-right: 4px; }
  .block { border: 1px solid #ddd; border-radius: 6px; margin: 10px 0; }
  .block:focus-within { border-color: #7a9cc6; }
  .block-bar { display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: #f7f7f7; border-bottom: 1px solid #eee; font-size: 12px; }
  .block-bar .spacer { flex: 1; }
  .block-bar button { border: none; background: none; cursor: pointer; padding: 2px 6px; }
  .block-label { font-weight: 600; color: #555; }
  .rich { padding: 10px 12px; min-height: 1.5em; outline: none; }
  .block[data-type=heading] .rich { font-size: 22px; font-weight: 600; }
  .block[data-type=quote] .rich { font-style: italic; border-left: 3px solid #ccc; margin: 8px 12px; }
  .block[data-type=callout] .rich { background: #eef4fb; margin: 8px; border-radius: 4px; }
  .block[data-type=callout]:has(option[value=warning]:checked) .rich { background: #fdf3e1; }
  .rich ul, .rich ol { margin: 0; }
  .image-fields { display: grid; gap: 6px; padding: 10px 12px; }
  .image-fields input { padding: 6px; }
  .image-preview { max-width: 240px; max-height: 160px; }
  .acc-items { padding: 8px; display: grid; gap: 8px; }
  .acc-item { border: 1px solid #e3e3e3; border-radius: 6px; background: #fcfcfc; }
  .acc-head { display: flex; align-items: center; gap: 4px; padding: 6px; border-bottom: 1px solid #eee; }
  .acc-head button { border: none; background: none; cursor: pointer; padding: 2px 6px; }
  .acc-title { flex: 1; font-weight: 600; font-size: 15px; padding: 6px; border: 1px solid transparent; background: transparent; }
  .acc-title:focus { border-color: #7a9cc6; background: #fff; outline: none; }
  .acc-content { padding: 0 10px 8px 24px; }
  .acc-item.collapsed .acc-content { display: none; }
  .acc-item.collapsed .acc-head { border-bottom: none; }
  .acc-content .block { background: #fff; }
  .inner-add { font-size: 12px; color: #777; }
  .inner-add button { font-size: 12px; margin: 2px; }
  .acc-add-item { margin: 0 8px 8px; }
  .add { margin: 12px 0; }
  .add button { margin: 2px; }
  .errors { color: #b00; background: #fdeeee; padding: 8px 12px; border-radius: 6px; }
  .errors li { margin: 2px 0; }
  .ok { color: #070; }
  pre.json { white-space: pre-wrap; background: #f5f5f5; padding: 8px; font-size: 12px; max-height: 400px; overflow: auto; }

  /* ── Editor de páginas: secciones y columnas ── */
  body.wide { max-width: 1240px; }
  .section-ed { border: 2px solid #c9d6e6; border-radius: 8px; margin: 16px 0; background: #f6f9fc; }
  .section-ed[data-background=light] { background: #fbf3f3; border-color: #e6c9c9; }
  .section-ed[data-background=accent] { background: #f3e3e3; border-color: #6e1717; }
  .section-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 10px; font-size: 13px; border-bottom: 1px solid #c9d6e6; }
  .section-bar .spacer { flex: 1; }
  .section-bar > button { border: none; background: none; cursor: pointer; padding: 2px 6px; }
  .section-label { font-weight: 700; color: #34506e; }
  .columns { display: grid; gap: 10px; padding: 10px; }
  .column-ed { border: 1px dashed #b5c3d4; border-radius: 6px; padding: 4px 8px 8px; background: rgba(255,255,255,.6); min-width: 0; }
  .column-label { font-size: 11px; color: #7a8ea5; text-transform: uppercase; letter-spacing: .04em; }
  .column-ed > .blocks-list:empty::before { content: 'Columna vacía'; display: block; color: #aab; font-size: 13px; padding: 12px 0; text-align: center; }
  .column-ed .block { background: #fff; }
  /* Los botones ← → para cambiar de columna solo tienen sentido dentro de una columna */
  .move-x { display: none; }
  .column-ed > .blocks-list > .block > .block-bar .move-x { display: inline; }
  .add-section button { margin: 2px; font-family: ui-monospace, monospace; }
  .layout-pick { display: inline-flex; gap: 4px; }
  .layout-pick button { font-family: ui-monospace, monospace; font-size: 12px; padding: 2px 6px; border: 1px solid #b5c3d4; background: #fff; border-radius: 4px; cursor: pointer; }
  .layout-pick button[aria-pressed=true] { background: #34506e; color: #fff; border-color: #34506e; }
</style></head><body class="${opts.wide ? 'wide' : ''}">${content}</body></html>`;

const statusBadge = (s) => `<span class="badge ${s}">${s === 'published' ? 'Publicado' : 'Borrador'}</span>`;

const listTable = (rows, type, publicUrl) => rows.length === 0 ? '<p>Todavía no hay nada aquí.</p>' : `
  <table>
    <tr><th>Título</th><th>Estado</th><th>Actualizado</th><th></th></tr>
    ${rows.map(r => `
      <tr>
        <td><a href="/admin/${type}/${r.id}">${esc(r.title)}</a></td>
        <td>${statusBadge(r.status)}</td>
        <td>${esc(r.updated_at)}</td>
        <td>${r.status === 'published' ? `<a href="${publicUrl(esc(r.slug))}" target="_blank">ver</a>` : ''}</td>
      </tr>`).join('')}
  </table>`;

exports.adminList = ({ articles, pages }) => adminLayout(`
  <p><a href="/" target="_blank">Ver sitio público</a></p>

  <h1>Páginas</h1>
  <p><a href="/admin/pages/new">+ Nueva página</a> · <a href="/api/pages" target="_blank">API</a>
     <br><small>Secciones con columnas. Para inicio, "quiénes somos", landings... Aparecen en el menú.</small></p>
  ${listTable(pages, 'pages', s => `/${s}`)}

  <h1>Artículos</h1>
  <p><a href="/admin/articles/new">+ Nuevo artículo</a> · <a href="/api/articles" target="_blank">API</a>
     <br><small>Una columna de bloques. Para el blog.</small></p>
  ${listTable(articles, 'articles', s => `/blog/${s}`)}
`);

// El editor por bloques. El documento inicial viaja dentro de un
// <script type="application/json"> y public/editor.js lo pinta.
// Al enviar, editor.js llena el campo oculto "content" con el JSON.
//
// a.kind = "articles" | "pages". El mismo editor.js sirve para los dos: el
// atributo data-mode de #blocks le dice si la raíz es una lista de bloques
// (artículo) o una lista de secciones (página).
exports.editor = (a) => {
  const isPage = a.kind === 'pages';
  const publicUrl = isPage ? `/${esc(a.slug)}` : `/blog/${esc(a.slug)}`;
  return adminLayout(`
  <p><a href="/admin">← Volver</a> · Editando ${isPage ? 'una <b>página</b>' : 'un <b>artículo</b>'}</p>
  ${a.errors?.length ? `<ul class="errors">${a.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
  ${a.saved ? '<p class="ok">Guardado.</p>' : ''}

  <form method="POST" action="/admin/${a.kind}/save" id="article-form">
    <input type="hidden" name="id" value="${esc(a.id ?? '')}">
    <input type="hidden" name="content" id="content">
    <input type="text" class="title" name="title" placeholder="Título" value="${esc(a.title ?? '')}">

    <div class="toolbar">
      <button type="button" data-format="bold"><b>N</b></button>
      <button type="button" data-format="italic"><i>K</i></button>
      <button type="button" data-format="link">Enlace</button>
      <button type="button" data-format="unlink">Quitar enlace</button>
    </div>

    <div id="blocks" data-mode="${isPage ? 'page' : 'article'}"></div>

    ${isPage ? `
    <div class="add add-section">Añadir sección:
      <button type="button" data-add-section="1">[ 1 columna ]</button>
      <button type="button" data-add-section="1/2+1/2">[ ½ | ½ ]</button>
      <button type="button" data-add-section="1/3+2/3">[ ⅓ | ⅔ ]</button>
      <button type="button" data-add-section="2/3+1/3">[ ⅔ | ⅓ ]</button>
      <button type="button" data-add-section="1/3+1/3+1/3">[ ⅓ | ⅓ | ⅓ ]</button>
    </div>` : `
    <div class="add">Añadir:
      <button type="button" data-add="paragraph">+ Párrafo</button>
      <button type="button" data-add="heading">+ Título</button>
      <button type="button" data-add="list">+ Lista</button>
      <button type="button" data-add="quote">+ Cita</button>
      <button type="button" data-add="image">+ Imagen</button>
      <button type="button" data-add="callout">+ Aviso</button>
      <button type="button" data-add="accordion">+ Acordeón</button>
    </div>`}

    <button name="action" value="draft">Guardar borrador</button>
    <button name="action" value="publish">Publicar</button>
    ${a.status ? ` Estado actual: <b>${a.status === 'published' ? 'Publicado' : 'Borrador'}</b>` : ''}
    ${a.slug && a.status === 'published' ? ` · <a href="${publicUrl}" target="_blank">Ver en el sitio</a>
      · <a href="/api/${a.kind}/${esc(a.slug)}" target="_blank">JSON</a>
      · <a href="/api/${a.kind}/${esc(a.slug)}/markdown" target="_blank">Markdown</a>` : ''}
  </form>

  <details style="margin-top:24px"${isPage ? '' : ' open'}><summary>¿Qué JSON se va a enviar?</summary>
    <pre class="json" id="json-preview"></pre>
  </details>

  <script type="application/json" id="initial-doc">${safeJson(a.doc)}</script>
  <script src="/editor.js"></script>
`, { wide: isPage });
};
