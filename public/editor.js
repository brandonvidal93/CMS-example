// public/editor.js — Editor por bloques (corre en el NAVEGADOR)
//
// Idea central: lo que el usuario ve son <div contenteditable>, pero lo que
// se envía al servidor NO es su HTML. Antes de enviar, recorremos el DOM de
// cada bloque y construimos el JSON: { version, blocks: [...] }.
//
//   cargar:  JSON  ->  bloques en pantalla   (renderBlock / spansToHtml)
//   guardar: bloques en pantalla  ->  JSON   (readBlock / domToSpans)

(function () {
  const blocksEl = document.getElementById('blocks');
  const previewEl = document.getElementById('json-preview');
  const form = document.getElementById('article-form');

  // "article": la raíz es una lista de bloques.
  // "page":    la raíz es una lista de SECCIONES; cada sección tiene columnas,
  //            y cada columna es una lista de bloques como la de un artículo.
  const MODE = blocksEl.dataset.mode || 'article';

  const LABELS = { paragraph: 'Párrafo', heading: 'Título', list: 'Lista', quote: 'Cita', image: 'Imagen', callout: 'Aviso', accordion: 'Acordeón' };
  // Bloques que se pueden añadir DENTRO de un acordeón (todos menos el propio acordeón;
  // el servidor aplica la misma regla, esto solo evita ofrecer algo que se rechazaría)
  const INNER_TYPES = ['paragraph', 'heading', 'list', 'quote', 'image', 'callout'];
  // En una columna se permite todo, acordeón incluido
  const COLUMN_TYPES = [...INNER_TYPES, 'accordion'];

  // Los mismos layouts que acepta el servidor (blocks/page-schema.js), con su
  // número de columnas y cómo previsualizarlos en el editor
  const LAYOUTS = {
    '1':           { cols: 1, grid: '1fr',         label: '1' },
    '1/2+1/2':     { cols: 2, grid: '1fr 1fr',     label: '½ ½' },
    '1/3+2/3':     { cols: 2, grid: '1fr 2fr',     label: '⅓ ⅔' },
    '2/3+1/3':     { cols: 2, grid: '2fr 1fr',     label: '⅔ ⅓' },
    '1/3+1/3+1/3': { cols: 3, grid: '1fr 1fr 1fr', label: '⅓ ⅓ ⅓' },
  };
  const BACKGROUNDS = [['none', 'Sin fondo'], ['light', 'Claro'], ['accent', 'Color']];
  const newId = () => Math.random().toString(16).slice(2, 10).padEnd(8, '0');

  // Cómo es un bloque recién creado, según su tipo
  function emptyBlock(type) {
    const b = { type, id: newId() };
    if (type === 'list') b.items = [[]];
    else if (type === 'accordion') b.items = [emptyAccordionItem()];
    else if (type !== 'image') b.content = [];
    return b;
  }
  const emptyAccordionItem = () => ({ title: '', blocks: [emptyBlock('paragraph')] });

  // ═══════════════════════════════════════════════
  // JSON -> pantalla
  // ═══════════════════════════════════════════════

  const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function spansToHtml(spans = []) {
    return spans.map(s => {
      let h = esc(s.text).replace(/\n/g, '<br>');
      if (s.marks?.includes('italic')) h = `<i>${h}</i>`;
      if (s.marks?.includes('bold')) h = `<b>${h}</b>`;
      if (s.href) h = `<a href="${esc(s.href)}">${h}</a>`;
      return h;
    }).join('');
  }

  // Crea el elemento visual de un bloque a partir de su JSON
  function renderBlock(b) {
    const el = document.createElement('div');
    el.className = 'block';
    el.dataset.type = b.type;
    el.dataset.id = b.id || newId();

    let options = '';
    if (b.type === 'heading') options = select('level', [['2', 'H2'], ['3', 'H3']], String(b.level || 2));
    if (b.type === 'list') options = select('style', [['bullet', '• Viñetas'], ['number', '1. Numerada']], b.style || 'bullet');
    if (b.type === 'callout') options = select('tone', [['info', 'Información'], ['warning', 'Atención']], b.tone || 'info');

    el.innerHTML = `
      <div class="block-bar">
        <span class="block-label">${LABELS[b.type]}</span>${options}
        <span class="spacer"></span>
        <button type="button" class="move-x" data-act="left" title="Mover a la columna de la izquierda">←</button>
        <button type="button" class="move-x" data-act="right" title="Mover a la columna de la derecha">→</button>
        <button type="button" data-act="up" title="Subir">↑</button>
        <button type="button" data-act="down" title="Bajar">↓</button>
        <button type="button" data-act="del" title="Eliminar">✕</button>
      </div>`;

    if (b.type === 'accordion') {
      const itemsEl = document.createElement('div');
      itemsEl.className = 'acc-items';
      (b.items?.length ? b.items : [emptyAccordionItem()]).forEach(it => itemsEl.appendChild(renderAccordionItem(it)));
      el.appendChild(itemsEl);
      el.insertAdjacentHTML('beforeend', `<button type="button" class="acc-add-item" data-act="item-add">+ Añadir elemento</button>`);
    } else if (b.type === 'image') {
      el.insertAdjacentHTML('beforeend', `
        <div class="image-fields">
          <input name="url" placeholder="URL de la imagen (https://...)" value="${esc(b.url)}">
          <input name="alt" placeholder="Texto alternativo (para lectores de pantalla)" value="${esc(b.alt)}">
          <input name="caption" placeholder="Pie de foto (opcional)" value="${esc(b.caption)}">
          <img class="image-preview" alt="">
        </div>`);
      const syncPreview = () => {
        const url = el.querySelector('[name=url]').value;
        const img = el.querySelector('.image-preview');
        img.hidden = !/^https?:\/\//.test(url);
        if (!img.hidden) img.src = url;
      };
      el.querySelector('[name=url]').addEventListener('input', syncPreview);
      syncPreview();
    } else {
      const rich = document.createElement('div');
      rich.className = 'rich';
      rich.contentEditable = 'true';
      rich.innerHTML = b.type === 'list'
        ? `<${b.style === 'number' ? 'ol' : 'ul'}>${(b.items?.length ? b.items : [[]]).map(it => `<li>${spansToHtml(it) || '<br>'}</li>`).join('')}</${b.style === 'number' ? 'ol' : 'ul'}>`
        : spansToHtml(b.content);
      el.appendChild(rich);
    }
    return el;
  }

  // Un elemento del acordeón: cabecera (título + controles) y una mini-lista de bloques.
  // Esa mini-lista se llena con renderBlock(), el mismo que usa el documento:
  // es la versión "navegador" de la recursión del esquema.
  function renderAccordionItem(it) {
    const item = document.createElement('div');
    item.className = 'acc-item';
    item.innerHTML = `
      <div class="acc-head">
        <button type="button" data-act="item-toggle" title="Plegar / desplegar" aria-expanded="true">▾</button>
        <input class="acc-title" placeholder="Título del elemento (la pregunta)" value="${esc(it.title)}">
        <button type="button" data-act="item-up" title="Subir elemento">↑</button>
        <button type="button" data-act="item-down" title="Bajar elemento">↓</button>
        <button type="button" data-act="item-del" title="Eliminar elemento">✕</button>
      </div>
      <div class="acc-content">
        <div class="blocks-list"></div>
        <div class="inner-add">Añadir dentro: ${INNER_TYPES.map(t => `<button type="button" data-inner-add="${t}">+ ${LABELS[t]}</button>`).join('')}</div>
      </div>`;
    const list = item.querySelector('.blocks-list');
    (it.blocks?.length ? it.blocks : [emptyBlock('paragraph')]).forEach(child => list.appendChild(renderBlock(child)));
    return item;
  }

  // ── Secciones (solo en modo página) ──
  //
  // Una sección es: barra (layout, fondo, ↑ ↓ ✕) + una rejilla de columnas.
  // Cada columna tiene su .blocks-list, que se llena con renderBlock(): los
  // bloques de una página son exactamente los mismos que los de un artículo.
  function renderSection(s) {
    const layout = LAYOUTS[s.layout] ? s.layout : '1';
    const el = document.createElement('div');
    el.className = 'section-ed';
    el.dataset.id = s.id || newId();
    el.dataset.layout = layout;
    el.dataset.background = s.background || 'none';
    el.innerHTML = `
      <div class="section-bar">
        <span class="section-label">Sección</span>
        <span class="layout-pick" role="group" aria-label="Columnas">
          ${Object.entries(LAYOUTS).map(([key, l]) =>
            `<button type="button" data-layout="${key}" aria-pressed="${key === layout}" title="Layout ${key}">${l.label}</button>`).join('')}
        </span>
        <label>Fondo: ${select('background', BACKGROUNDS, el.dataset.background)}</label>
        <span class="spacer"></span>
        <button type="button" data-act="section-up" title="Subir sección">↑</button>
        <button type="button" data-act="section-down" title="Bajar sección">↓</button>
        <button type="button" data-act="section-del" title="Eliminar sección">✕</button>
      </div>
      <div class="columns"></div>`;

    const columnsEl = el.querySelector('.columns');
    const cols = s.columns || [];
    for (let i = 0; i < LAYOUTS[layout].cols; i++) columnsEl.appendChild(renderColumn(cols[i]?.blocks || []));
    refreshColumns(el);
    return el;
  }

  function renderColumn(blocks) {
    const col = document.createElement('div');
    col.className = 'column-ed';
    col.innerHTML = `
      <div class="column-label"></div>
      <div class="blocks-list"></div>
      <div class="inner-add">Añadir: ${COLUMN_TYPES.map(t => `<button type="button" data-inner-add="${t}">+ ${LABELS[t]}</button>`).join('')}</div>`;
    const list = col.querySelector('.blocks-list');
    blocks.forEach(b => list.appendChild(renderBlock(b)));
    return col;
  }

  // Ajusta la rejilla visual y los rótulos "Columna 1, 2..." al layout actual
  function refreshColumns(sectionEl) {
    const layout = LAYOUTS[sectionEl.dataset.layout];
    sectionEl.querySelector(':scope > .columns').style.gridTemplateColumns = layout.grid;
    sectionEl.querySelectorAll(':scope > .columns > .column-ed').forEach((c, i) =>
      c.querySelector(':scope > .column-label').textContent = `Columna ${i + 1}`);
    sectionEl.querySelectorAll(':scope > .section-bar [data-layout]').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.layout === sectionEl.dataset.layout)));
  }

  // Cambiar el layout cambia el NÚMERO de columnas. Regla: nunca perder contenido.
  //   - Si hacen falta más columnas, se añaden vacías.
  //   - Si sobran, sus bloques se mueven a la última columna que queda.
  function changeLayout(sectionEl, newLayout) {
    const columnsEl = sectionEl.querySelector(':scope > .columns');
    const cols = [...columnsEl.children];
    const wanted = LAYOUTS[newLayout].cols;

    for (let i = cols.length; i < wanted; i++) columnsEl.appendChild(renderColumn([]));
    if (cols.length > wanted) {
      const keep = cols[wanted - 1].querySelector(':scope > .blocks-list');
      cols.slice(wanted).forEach(extra => {
        // Movemos los NODOS, no los re-creamos: así se conserva lo que estaba escrito tal cual
        [...extra.querySelector(':scope > .blocks-list').children].forEach(b => keep.appendChild(b));
        extra.remove();
      });
    }
    sectionEl.dataset.layout = newLayout;
    refreshColumns(sectionEl);
  }

  function addSection(layout) {
    const el = renderSection({ layout, columns: [] });
    blocksEl.appendChild(el);
    // Para empezar a escribir enseguida: un párrafo vacío en la primera columna
    const firstList = el.querySelector('.column-ed > .blocks-list');
    addBlock('paragraph', null, true, firstList);
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return el;
  }

  function select(name, opts, value) {
    return ` <select name="${name}">${opts.map(([v, t]) => `<option value="${v}"${v === value ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  }

  // ═══════════════════════════════════════════════
  // pantalla -> JSON   (esto es lo que se guarda)
  // ═══════════════════════════════════════════════

  // Recorre el DOM editable y devuelve una lista de spans.
  // <b>Hola <i>mundo</i></b>  ->  [{text:"Hola ",marks:["bold"]}, {text:"mundo",marks:["bold","italic"]}]
  function domToSpans(root) {
    const out = [];
    const push = (text, marks, href) => {
      const span = { text, marks: [...marks].sort() };
      if (href) span.href = href;
      out.push(span);
    };

    (function walk(node, marks, href) {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          push(child.nodeValue.replace(/ /g, ' '), marks, href);
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;

        const tag = child.nodeName.toLowerCase();
        if (tag === 'br') { push('\n', marks, href); continue; }

        // Bloques anidados que el navegador a veces crea al pegar o al pulsar Enter
        if (['div', 'p', 'li'].includes(tag) && out.length) push('\n', marks, href);

        const m = new Set(marks);
        if (tag === 'b' || tag === 'strong') m.add('bold');
        if (tag === 'i' || tag === 'em') m.add('italic');
        // Cualquier otra etiqueta (span, font, u...) se ignora: solo conservamos su texto
        walk(child, m, tag === 'a' ? child.getAttribute('href') : href);
      }
    })(root, new Set(), null);

    // Unir vecinos con el mismo formato y limpiar saltos sobrantes al final
    const merged = [];
    for (const s of out) {
      const prev = merged[merged.length - 1];
      if (prev && prev.href === s.href && prev.marks.join() === s.marks.join()) prev.text += s.text;
      else merged.push(s);
    }
    if (merged.length) {
      const last = merged[merged.length - 1];
      last.text = last.text.replace(/\n+$/, '');
    }
    return merged.filter(s => s.text !== '');
  }

  function readBlock(el) {
    const type = el.dataset.type;
    const b = { id: el.dataset.id, type };
    const val = (name) => el.querySelector(`[name=${name}]`).value;
    const rich = el.querySelector('.rich');

    if (type === 'accordion') {
      // :scope > ...  = solo hijos DIRECTOS, para no confundir los elementos de
      // este acordeón con nada de lo que hay más adentro
      b.items = [...el.querySelectorAll(':scope > .acc-items > .acc-item')].map(item => ({
        title: item.querySelector(':scope > .acc-head > .acc-title').value.trim(),
        blocks: readList(item.querySelector(':scope > .acc-content > .blocks-list')), // ← recursión
      }));
      return b;
    }

    if (type === 'heading') b.level = Number(val('level'));
    if (type === 'callout') b.tone = val('tone');
    if (type === 'list') {
      b.style = val('style');
      const lis = rich.querySelectorAll('li');
      b.items = lis.length ? [...lis].map(domToSpans) : [domToSpans(rich)];
    } else if (type === 'image') {
      b.url = val('url').trim();
      b.alt = val('alt').trim();
      b.caption = val('caption').trim();
    } else {
      b.content = domToSpans(rich);
    }
    return b;
  }

  // Lee una lista de bloques: la del documento o la de dentro de un elemento del acordeón
  const readList = (listEl) => [...listEl.children].filter(c => c.classList.contains('block')).map(readBlock);

  // Una sección: su layout y fondo + cada columna leída con readList (lo mismo de siempre)
  const readSection = (el) => ({
    id: el.dataset.id,
    layout: el.dataset.layout,
    background: el.dataset.background,
    columns: [...el.querySelectorAll(':scope > .columns > .column-ed')].map(col => ({
      blocks: readList(col.querySelector(':scope > .blocks-list')),
    })),
  });

  const serialize = () => MODE === 'page'
    ? { version: 1, sections: [...blocksEl.children].filter(c => c.classList.contains('section-ed')).map(readSection) }
    : { version: 1, blocks: readList(blocksEl) };

  // ═══════════════════════════════════════════════
  // Interacción
  // ═══════════════════════════════════════════════

  // afterEl: insertar justo después de ese bloque (en SU misma lista, sea la
  // principal o la de un acordeón). Si no hay, se añade al final de "container".
  function addBlock(type, afterEl, focus = true, container = blocksEl) {
    const el = renderBlock(emptyBlock(type));
    if (afterEl) afterEl.after(el); else container.appendChild(el);
    if (focus) focusEnd(el);
    updatePreview();
    return el;
  }

  function focusEnd(blockEl) {
    if (blockEl.dataset.type === 'accordion') {        // un acordeón nuevo: empezar por el título
      blockEl.querySelector('.acc-title').focus();
      return;
    }
    const target = blockEl.querySelector('.rich li:last-child') || blockEl.querySelector('.rich') || blockEl.querySelector('input');
    if (!target) return;
    target.focus();
    if (target.isContentEditable || target.closest('.rich')) {
      blockEl.querySelector('.rich').focus();
      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(false);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  // Botones "+ Párrafo", "+ Título", ... (artículos)
  document.querySelectorAll('[data-add]').forEach(btn =>
    btn.addEventListener('click', () => addBlock(btn.dataset.add)));

  // Botones "Añadir sección [ ⅓ | ⅔ ]" ... (páginas)
  document.querySelectorAll('[data-add-section]').forEach(btn =>
    btn.addEventListener('click', () => { addSection(btn.dataset.addSection); updatePreview(); }));

  // Un solo "escuchador" para todos los botones, también los de los acordeones que se
  // creen después (delegación de eventos: el clic sube hasta #blocks y aquí se decide).
  blocksEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    // "+ Párrafo", "+ Lista"... dentro de un elemento del acordeón O de una columna.
    // closest() encuentra el contenedor más cercano: si el botón está en un acordeón
    // que a su vez está en una columna, gana el acordeón (que es lo correcto).
    if (btn.dataset.innerAdd) {
      const list = btn.closest('.acc-content, .column-ed').querySelector(':scope > .blocks-list');
      addBlock(btn.dataset.innerAdd, null, true, list);
      return;
    }

    // Botones de layout de una sección: [1] [½ ½] [⅓ ⅔] ...
    if (btn.dataset.layout) {
      changeLayout(btn.closest('.section-ed'), btn.dataset.layout);
      updatePreview();
      return;
    }

    const act = btn.dataset.act;
    if (!act) return;

    // Acciones sobre una SECCIÓN
    if (act.startsWith('section-')) {
      const sec = btn.closest('.section-ed');
      if (act === 'section-up' && sec.previousElementSibling) sec.previousElementSibling.before(sec);
      if (act === 'section-down' && sec.nextElementSibling) sec.nextElementSibling.after(sec);
      if (act === 'section-del') {
        const hasContent = sec.querySelector('.block');
        if (!hasContent || confirm('¿Eliminar esta sección y todo su contenido?')) sec.remove();
      }
      updatePreview();
      return;
    }

    // Mover un bloque a la columna vecina (← →). Se añade al final de esa columna.
    if (act === 'left' || act === 'right') {
      const el = btn.closest('.block');
      const col = el.parentElement.closest('.column-ed');
      const target = act === 'left' ? col?.previousElementSibling : col?.nextElementSibling;
      if (target) {
        target.querySelector(':scope > .blocks-list').appendChild(el);
        el.scrollIntoView({ block: 'nearest' });
      }
      updatePreview();
      return;
    }

    // Acciones sobre un ELEMENTO del acordeón
    if (act.startsWith('item-')) {
      const acc = btn.closest('.block[data-type=accordion]');
      const item = btn.closest('.acc-item');
      if (act === 'item-add') {
        const fresh = renderAccordionItem(emptyAccordionItem());
        acc.querySelector(':scope > .acc-items').appendChild(fresh);
        fresh.querySelector('.acc-title').focus();
      }
      if (act === 'item-up' && item.previousElementSibling) item.previousElementSibling.before(item);
      if (act === 'item-down' && item.nextElementSibling) item.nextElementSibling.after(item);
      if (act === 'item-del') {
        // Si era el último elemento, se va el acordeón entero
        if (acc.querySelectorAll(':scope > .acc-items > .acc-item').length === 1) acc.remove();
        else item.remove();
      }
      if (act === 'item-toggle') {
        const collapsed = item.classList.toggle('collapsed'); // solo visual: no cambia el JSON
        btn.textContent = collapsed ? '▸' : '▾';
        btn.setAttribute('aria-expanded', String(!collapsed));
      }
      updatePreview();
      return;
    }

    // Acciones sobre un BLOQUE (funciona igual en la lista principal y dentro de un acordeón,
    // porque closest() encuentra el bloque más cercano y los hermanos son los de su misma lista)
    const el = btn.closest('.block');
    if (act === 'up' && el.previousElementSibling) el.previousElementSibling.before(el);
    if (act === 'down' && el.nextElementSibling) el.nextElementSibling.after(el);
    if (act === 'del') el.remove();
    updatePreview();
  });

  // Cambiar viñetas <-> numerada reemplaza <ul> por <ol> conservando el contenido
  blocksEl.addEventListener('change', (e) => {
    if (e.target.name === 'style') {
      const el = e.target.closest('.block');
      const replacement = renderBlock(readBlock(el));
      el.replaceWith(replacement);
    }
    // Fondo de una sección: se guarda en data-background (lo lee readSection y lo usa el CSS)
    if (e.target.name === 'background') {
      e.target.closest('.section-ed').dataset.background = e.target.value;
    }
    updatePreview();
  });

  blocksEl.addEventListener('keydown', (e) => {
    // Enter en un <input> enviaría el formulario entero sin querer. Lo evitamos.
    // En el título de un elemento del acordeón, Enter salta a su contenido.
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      if (e.target.classList.contains('acc-title')) {
        const first = e.target.closest('.acc-item').querySelector('.acc-content .block');
        if (first) focusEnd(first);
      }
      return;
    }

    const rich = e.target.closest?.('.rich');
    if (!rich) return;
    const el = rich.closest('.block');
    const type = el.dataset.type;

    if (e.key === 'Enter') {
      if (type === 'list') {
        // Enter en un elemento vacío de la lista: salir de la lista
        const li = getSelection().anchorNode?.parentElement?.closest('li') || getSelection().anchorNode?.closest?.('li');
        if (li && li.textContent.trim() === '' && !li.nextElementSibling) {
          e.preventDefault();
          if (rich.querySelectorAll('li').length > 1) li.remove();
          addBlock('paragraph', el);
        }
        return;
      }
      e.preventDefault();
      if (e.shiftKey) document.execCommand('insertLineBreak');   // Shift+Enter: salto de línea dentro del bloque
      else addBlock('paragraph', el);                           // Enter: bloque nuevo, como en Notion
    }

    // Retroceso en un párrafo vacío: borrar el bloque y volver al anterior
    if (e.key === 'Backspace' && type === 'paragraph' && rich.textContent === '' && el.previousElementSibling) {
      e.preventDefault();
      const prev = el.previousElementSibling;
      el.remove();
      focusEnd(prev);
      updatePreview();
    }
  });

  // Al pegar, solo aceptamos texto plano: así no entran estilos raros de Word o de otras webs
  blocksEl.addEventListener('paste', (e) => {
    if (!e.target.closest?.('.rich')) return;
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  });

  // Barra de formato: negrita, cursiva, enlace
  document.querySelectorAll('[data-format]').forEach(btn => {
    btn.addEventListener('mousedown', e => e.preventDefault()); // no perder la selección
    btn.addEventListener('click', () => {
      const f = btn.dataset.format;
      if (f === 'link') {
        const url = prompt('URL del enlace (https://...)');
        if (url && /^(https?:|mailto:)/.test(url)) document.execCommand('createLink', false, url);
        else if (url) alert('El enlace debe empezar por http://, https:// o mailto:');
      } else if (f === 'unlink') {
        document.execCommand('unlink');
      } else {
        document.execCommand(f);
      }
      updatePreview();
    });
  });

  // Vista en vivo del JSON que se va a enviar
  function updatePreview() {
    previewEl.textContent = JSON.stringify(serialize(), null, 2);
  }
  blocksEl.addEventListener('input', updatePreview);

  // Al enviar: el JSON viaja en el campo oculto "content"
  form.addEventListener('submit', () => {
    document.getElementById('content').value = JSON.stringify(serialize());
  });

  // ═══════════════════════════════════════════════
  // Arranque: pintar el documento que mandó el servidor
  // ═══════════════════════════════════════════════
  const initial = JSON.parse(document.getElementById('initial-doc').textContent);
  if (MODE === 'page') {
    (initial.sections || []).forEach(s => blocksEl.appendChild(renderSection(s)));
    if (!initial.sections?.length) {
      // Página nueva: una sección de una columna con un párrafo vacío, sin robar el foco al título
      const sec = renderSection({ layout: '1', columns: [{ blocks: [emptyBlock('paragraph')] }] });
      blocksEl.appendChild(sec);
    }
  } else {
    (initial.blocks || []).forEach(b => blocksEl.appendChild(renderBlock(b)));
    if (!initial.blocks?.length) addBlock('paragraph', null, false);
  }
  updatePreview();
})();
