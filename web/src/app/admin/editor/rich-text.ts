// rich-text.ts — Un área contenteditable conectada a una señal de spans
//
// La regla de oro de un contenteditable con Angular: NO enlazar [innerHTML] al
// modelo. Si cada letra que escribes actualiza la señal y la señal vuelve a
// pintar el HTML, el navegador pierde la posición del cursor (salta al inicio).
//
// Así que el flujo es en un solo sentido mientras escribes:
//   - al crearse: modelo -> HTML (una vez)
//   - al escribir: HTML -> modelo  (domToSpans)
// Solo se vuelve a pintar desde el modelo cuando cambia algo estructural
// (pasar una lista de viñetas a numerada).

import { Component, effect, ElementRef, inject, input, output, untracked, type WritableSignal } from '@angular/core';
import type { Mark, Span } from '../../content/types';
import { MARK_BY_TAG } from '../../content/marks';
import { spansToHtml } from '../../content/inline-html';
import { EditorState } from './editor-state';

@Component({
  selector: 'app-rich-text',
  template: '',
  host: {
    // Tailwind quita a las listas sus viñetas (preflight). Como el HTML de aquí
    // lo crea el navegador y no Angular, lo estilamos desde el contenedor con
    // variantes arbitrarias: [&_ul]:list-disc = "a cualquier ul de dentro, list-disc".
    class: 'rich block min-h-6 px-3 py-2 outline-none [&_a]:text-sky-700 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_mark]:bg-yellow-200 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.9em]',
    contenteditable: 'true',
    '(input)': 'onInput()',
    '(keydown)': 'onKeydown($event)',
    '(paste)': 'onPaste($event)',
  },
})
export class RichText {
  readonly blockId = input.required<string>();
  // Modo texto: una lista de spans. Modo lista: una lista de spans POR elemento.
  readonly content = input<WritableSignal<Span[]>>();
  readonly items = input<WritableSignal<Span[][]>>();
  readonly listStyle = input<'bullet' | 'number'>('bullet');
  // ¿Se puede borrar el bloque con Retroceso cuando está vacío? (solo párrafos)
  readonly removable = input(false);

  readonly enter = output<void>();
  readonly removeEmpty = output<void>();

  private el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private state = inject(EditorState);

  constructor() {
    // Pintar desde el modelo: al crearse y cada vez que cambia listStyle (lo único
    // que leemos con seguimiento). El contenido se lee con untracked(): escribir
    // texto NO debe provocar un repintado.
    effect(() => {
      this.listStyle();
      untracked(() => this.render());
    });

    // Pedir el foco desde fuera (al crear un bloque nuevo, por ejemplo)
    effect(() => {
      if (this.state.focusRequest() === this.blockId()) {
        untracked(() => {
          this.state.focusRequest.set(null);
          // Si ya está en la página, enfocamos ya; si no, en cuanto lo esté
          if (this.el.isConnected) this.focusEnd();
          else setTimeout(() => this.focusEnd());
        });
      }
    });
  }

  private render() {
    if (this.items()) {
      const tag = this.listStyle() === 'number' ? 'ol' : 'ul';
      const items = this.items()!();
      this.el.innerHTML = `<${tag}>${(items.length ? items : [[]]).map(it => `<li>${spansToHtml(it) || '<br>'}</li>`).join('')}</${tag}>`;
    } else {
      this.el.innerHTML = spansToHtml(this.content()?.() ?? []);
    }
  }

  // HTML -> modelo (en cada tecla)
  onInput() {
    const items = this.items();
    if (items) {
      const lis = this.el.querySelectorAll('li');
      items.set(lis.length ? [...lis].map(domToSpans) : [domToSpans(this.el)]);
    } else {
      this.content()?.set(domToSpans(this.el));
    }
  }

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (this.items()) {
        // En una lista, Enter crea otro elemento (lo hace el navegador)...
        // ...salvo en un elemento vacío al final: entonces se sale de la lista.
        const li = closestLi(getSelection()?.anchorNode ?? null);
        if (li && li.textContent?.trim() === '' && !li.nextElementSibling) {
          e.preventDefault();
          if (this.el.querySelectorAll('li').length > 1) li.remove();
          this.onInput();
          this.enter.emit();
        }
        return;
      }
      e.preventDefault();
      if (e.shiftKey) document.execCommand('insertLineBreak'); // salto de línea dentro del bloque
      else this.enter.emit();                                 // bloque nuevo, como en Notion
    }

    if (e.key === 'Backspace' && this.removable() && this.el.textContent === '') {
      e.preventDefault();
      this.removeEmpty.emit();
    }
  }

  // Al pegar, solo texto plano: así no entran estilos de Word o de otras webs
  onPaste(e: ClipboardEvent) {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '');
  }

  focusEnd() {
    this.el.focus();
    const target = this.el.querySelector('li:last-child') ?? this.el;
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    const sel = getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
}

// ─── Conversión HTML <-> spans ───
// spansToHtml (modelo -> HTML) viene de content/inline-html.ts: el editor pinta
// igual que el sitio público. domToSpans (HTML -> modelo) está aquí abajo.
// Las dos usan el registro de formatos (content/marks.ts).

// <b>Hola <i>mundo</i></b>  ->  [{text:"Hola ",marks:["bold"]}, {text:"mundo",marks:["bold","italic"]}]
function domToSpans(root: Element): Span[] {
  const out: Span[] = [];
  const push = (text: string, marks: Set<Mark>, href: string | null) =>
    out.push({ text, marks: [...marks].sort(), ...(href ? { href } : {}) });

  (function walk(node: Node, marks: Set<Mark>, href: string | null) {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) { push((child.nodeValue ?? '').replace(/ /g, ' '), marks, href); continue; }
      if (!(child instanceof Element)) continue;
      const tag = child.tagName.toLowerCase();
      if (tag === 'br') { push('\n', marks, href); continue; }
      if (['div', 'p', 'li'].includes(tag) && out.length) push('\n', marks, href);
      // ¿Esta etiqueta es un formato conocido? (b/strong -> bold, i/em -> italic...)
      // Cualquier otra (span, font, u...) se ignora: solo conservamos su texto
      const m = new Set(marks);
      const mark = MARK_BY_TAG[tag];
      if (mark) m.add(mark);
      walk(child, m, tag === 'a' ? child.getAttribute('href') : href);
    }
  })(root, new Set(), null);

  const merged: Span[] = [];
  for (const s of out) {
    const prev = merged[merged.length - 1];
    if (prev && prev.href === s.href && prev.marks.join() === s.marks.join()) prev.text += s.text;
    else merged.push(s);
  }
  if (merged.length) merged[merged.length - 1].text = merged[merged.length - 1].text.replace(/\n+$/, '');
  return merged.filter(s => s.text !== '');
}

// ─── Aplicar un formato que el navegador no sabe aplicar ───
//
// execCommand sabe hacer negrita, cursiva, tachado... pero no <mark> ni <code>.
// Para esos, lo hacemos a mano con la API de selección del navegador:
//   - si toda la selección ya está dentro de esa etiqueta -> se quita (se "desenvuelve")
//   - si no -> se saca lo seleccionado, se mete en una etiqueta nueva y se vuelve a poner
// Al final avisamos con un evento "input": RichText lo escucha y actualiza el modelo,
// exactamente igual que cuando escribes.
//
// Limitación: los cambios hechos así no entran en el deshacer del navegador (Ctrl+Z).
export function wrapSelection(tag: string, reads: string[]) {
  const sel = getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);

  const common = range.commonAncestorContainer;
  const commonEl = common instanceof Element ? common : common.parentElement;
  const rich = commonEl?.closest('.rich');
  if (!rich) return; // la selección no está dentro de un bloque de texto

  // En una lista, una selección que cruza varios elementos <li> no se puede
  // envolver en una sola etiqueta sin romper la lista: no hacemos nada.
  if (commonEl && ['UL', 'OL'].includes(commonEl.tagName)) return;

  // La etiqueta de este formato que envuelve a un nodo (o null si no hay)
  const formatAncestor = (node: Node): Element | null => {
    for (let el = node.parentElement; el && el !== rich; el = el.parentElement) {
      if (reads.includes(el.tagName.toLowerCase())) return el;
    }
    return null;
  };

  // Los trozos de texto que de verdad tienen algo seleccionado. Una selección puede
  // empezar justo en el borde de una etiqueta (al final del texto anterior): ese
  // trozo no cuenta, aunque técnicamente "toque" la selección.
  const selectedTexts: Text[] = [];
  const walker = document.createTreeWalker(rich, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (!range.intersectsNode(n)) continue;
    const from = n === range.startContainer ? range.startOffset : 0;
    const to = n === range.endContainer ? range.endOffset : n.length;
    if (to > from) selectedTexts.push(n);
  }

  // ¿Todo lo seleccionado tiene ya este formato? Entonces el botón lo QUITA.
  const ancestors = selectedTexts.map(formatAncestor);
  if (selectedTexts.length && ancestors.every(a => a !== null)) {
    new Set(ancestors as Element[]).forEach(unwrap);
  } else {
    const fragment = range.extractContents();
    fragment.querySelectorAll(reads.join(',')).forEach(unwrap); // sin <mark> dentro de <mark>
    const wrapper = document.createElement(tag);
    wrapper.appendChild(fragment);
    range.insertNode(wrapper);
    // Dejamos seleccionado lo que acabamos de envolver, como hacen los demás botones
    const after = document.createRange();
    after.selectNodeContents(wrapper);
    sel.removeAllRanges();
    sel.addRange(after);
  }
  // extractContents puede dejar etiquetas de formato vacías en los bordes
  // (<mark></mark>, <b></b>...): no aportan nada, fuera
  rich.querySelectorAll(Object.keys(MARK_BY_TAG).join(',')).forEach(el => { if (!el.textContent) el.remove(); });
  rich.dispatchEvent(new Event('input', { bubbles: true }));
}

// Quita una etiqueta dejando su contenido en su lugar: <mark>hola</mark> -> hola
function unwrap(el: Element) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function closestLi(node: Node | null): HTMLLIElement | null {
  const el = node instanceof Element ? node : node?.parentElement;
  return (el?.closest('li') as HTMLLIElement) ?? null;
}
