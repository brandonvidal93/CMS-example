// accordion-editor.ts — Los elementos de un acordeón: título + su propia lista de bloques
//
// Recursión: este componente usa BlockListEditor, que usa BlockEditor, que usa
// este componente. Los archivos se importan en círculo, así que aquí se usa
// forwardRef(): "la clase existirá cuando haga falta, aunque ahora no esté lista".

import { Component, forwardRef, inject, input } from '@angular/core';
import { BlockListEditor } from './block-list-editor';
import { EditorState } from './editor-state';
import { type AccordionVM, emptyAccordionItem, INNER_TYPES, move, removeAt } from './model';

@Component({
  selector: 'app-accordion-editor',
  imports: [forwardRef(() => BlockListEditor)],
  template: `
    @let acc = block();
    <div class="acc-items">
      @for (it of acc.items(); track it.key; let i = $index) {
        <div class="acc-item" [class.collapsed]="it.collapsed()">
          <div class="acc-head">
            <button type="button" title="Plegar / desplegar" [attr.aria-expanded]="!it.collapsed()"
                    (click)="it.collapsed.update(c => !c)">{{ it.collapsed() ? '▸' : '▾' }}</button>
            <input class="acc-title" placeholder="Título del elemento (la pregunta)"
                   [id]="'title-' + it.key" [value]="it.title()"
                   (input)="it.title.set(val($event))" (keydown.enter)="focusFirst($event, i)" />
            <button type="button" title="Subir elemento" (click)="acc.items.update(l => move(l, i, -1))">↑</button>
            <button type="button" title="Bajar elemento" (click)="acc.items.update(l => move(l, i, 1))">↓</button>
            <button type="button" title="Eliminar elemento" (click)="acc.items.update(l => removeAt(l, i))">✕</button>
          </div>
          @if (!it.collapsed()) {
            <div class="acc-content">
              <app-block-list-editor [list]="it.blocks" [allowed]="innerTypes" addLabel="Añadir dentro:" />
            </div>
          }
        </div>
      }
    </div>
    <button type="button" class="acc-add-item" (click)="addItem()">+ Añadir elemento</button>
  `,
})
export class AccordionEditor {
  readonly block = input.required<AccordionVM>();
  protected innerTypes = INNER_TYPES;
  protected move = move;
  protected removeAt = removeAt;
  private state = inject(EditorState);

  addItem() {
    const item = emptyAccordionItem();
    this.block().items.update(l => [...l, item]);
    this.state.focusElement('title-' + item.key);
  }

  // Enter en el título: no envía nada; salta al primer bloque del elemento
  focusFirst(e: Event, i: number) {
    e.preventDefault();
    const first = this.block().items()[i].blocks()[0];
    if (first) this.state.focus(first.id);
  }

  protected val = (e: Event) => (e.target as HTMLInputElement).value;
}
