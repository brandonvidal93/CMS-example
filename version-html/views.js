// views.js — Las "plantillas" (el tema)
// Cada función recibe datos de la BD y devuelve HTML. Es lo que en
// WordPress sería el tema, o en otros CMS archivos .twig / .ejs / .hbs.

// Escapa texto plano para que no se interprete como HTML (protege el título, etc.)
const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// ── Layout del sitio público: cabecera + contenido + pie ──
const publicLayout = (title, content) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 680px; margin: 0 auto; padding: 24px 16px; color: #b33b3b; line-height: 1.7; }
  header a { color: #6e1717; text-decoration: none; font-weight: bold; }
  .meta { color: #777; font-size: 14px; }
  article h2 { margin-top: 1.6em; }
  footer { margin-top: 48px; color: #999; font-size: 13px; }
</style></head>
<body>
  <header><a href="/">Mi Blog</a></header>
  ${content}
  <footer>Hecho con Mini CMS</footer>
</body></html>`;

exports.publicHome = (articles) => publicLayout('Mi Blog', `
  <h1>Últimos artículos</h1>
  ${articles.length === 0 ? '<p>Todavía no hay artículos publicados.</p>' : ''}
  ${articles.map(a => `
    <section>
      <h2><a href="/blog/${esc(a.slug)}">${esc(a.title)}</a></h2>
      <p class="meta">${esc(a.published_at)}</p>
      <p>${esc(a.excerpt)}</p>
    </section>`).join('')}
`);

// Fíjate: el título se escapa con esc(), pero el body se inserta TAL CUAL,
// porque ya es HTML y ya lo limpiamos al guardar.
exports.publicArticle = (a) => publicLayout(a.title, `
  <article>
    <h1>${esc(a.title)}</h1>
    <p class="meta">Publicado el ${esc(a.published_at)}</p>
    ${a.body}
  </article>
`);

exports.notFound = () => publicLayout('No encontrado', '<h1>404</h1><p>Este artículo no existe o no está publicado.</p>');

// ── Panel de administración ──
const adminLayout = (content) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 860px; margin: 0 auto; padding: 24px 16px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
  .badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; }
  .draft { background: #eee; } .published { background: #d4f5d4; }
  input[type=text] { width: 100%; font-size: 22px; padding: 8px; box-sizing: border-box; }
  .toolbar button { margin-right: 4px; }
  #editor { border: 1px solid #ccc; min-height: 240px; padding: 12px; margin: 8px 0; }
  .error { color: #b00; } .ok { color: #070; }
</style></head><body>${content}</body></html>`;

exports.adminList = (articles) => adminLayout(`
  <h1>Artículos</h1>
  <p><a href="/admin/new">+ Nuevo artículo</a> · <a href="/" target="_blank">Ver sitio público</a></p>
  <table>
    <tr><th>Título</th><th>Estado</th><th>Actualizado</th><th></th></tr>
    ${articles.map(a => `
      <tr>
        <td><a href="/admin/edit/${a.id}">${esc(a.title)}</a></td>
        <td><span class="badge ${a.status}">${a.status === 'published' ? 'Publicado' : 'Borrador'}</span></td>
        <td>${esc(a.updated_at)}</td>
        <td>${a.status === 'published' ? `<a href="/blog/${esc(a.slug)}" target="_blank">ver</a>` : ''}</td>
      </tr>`).join('')}
  </table>
`);

// El editor: un <div contenteditable> + botones. Al enviar, copiamos su
// innerHTML a un campo oculto "body" -> eso es lo que viaja al servidor.
exports.editor = (a) => adminLayout(`
  <p><a href="/admin">← Volver</a></p>
  ${a.error ? `<p class="error">${esc(a.error)}</p>` : ''}
  <form method="POST" action="/admin/save" onsubmit="document.getElementById('body').value = document.getElementById('editor').innerHTML">
    <input type="hidden" name="id" value="${esc(a.id ?? '')}">
    <input type="hidden" name="body" id="body">
    <input type="text" name="title" placeholder="Título" value="${esc(a.title ?? '')}">

    <div class="toolbar">
      <button type="button" onclick="document.execCommand('formatBlock', false, 'h2')">H2</button>
      <button type="button" onclick="document.execCommand('formatBlock', false, 'p')">Párrafo</button>
      <button type="button" onclick="document.execCommand('bold')"><b>N</b></button>
      <button type="button" onclick="document.execCommand('italic')"><i>K</i></button>
      <button type="button" onclick="document.execCommand('insertUnorderedList')">• Lista</button>
    </div>
    <div id="editor" contenteditable="true">${a.body ?? '<p>Empieza a escribir...</p>'}</div>

    <button name="action" value="draft">Guardar borrador</button>
    <button name="action" value="publish">Publicar</button>
    ${a.status ? ` Estado actual: <b>${a.status === 'published' ? 'Publicado' : 'Borrador'}</b>` : ''}
    ${a.slug && a.status === 'published' ? ` · <a href="/blog/${esc(a.slug)}" target="_blank">Ver en el sitio</a>` : ''}
  </form>

  <details style="margin-top:24px"><summary>¿Qué HTML se va a enviar?</summary>
    <pre id="preview" style="white-space:pre-wrap;background:#f5f5f5;padding:8px"></pre>
  </details>
  <script>
    const ed = document.getElementById('editor'), pv = document.getElementById('preview');
    const show = () => pv.textContent = ed.innerHTML;
    ed.addEventListener('input', show); show();
  </script>
`);
