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
import { EditorState } from './editor-state';

@Component({
  selector: 'app-rich-text',
  template: '',
  host: {
    class: 'rich',
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

// ─── Conversión HTML <-> spans (igual que en editor.js) ───

const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function spansToHtml(spans: Span[]): string {
  return spans.map(s => {
    let h = esc(s.text).replace(/\n/g, '<br>');
    if (s.marks.includes('italic')) h = `<i>${h}</i>`;
    if (s.marks.includes('bold')) h = `<b>${h}</b>`;
    if (s.href) h = `<a href="${esc(s.href)}">${h}</a>`;
    return h;
  }).join('');
}

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
      const m = new Set(marks);
      if (tag === 'b' || tag === 'strong') m.add('bold');
      if (tag === 'i' || tag === 'em') m.add('italic');
      // cualquier otra etiqueta (span, font, u...) se ignora: solo conservamos su texto
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

function closestLi(node: Node | null): HTMLLIElement | null {
  const el = node instanceof Element ? node : node?.parentElement;
  return (el?.closest('li') as HTMLLIElement) ?? null;
}
