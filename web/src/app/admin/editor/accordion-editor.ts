// accordion-editor.ts — Los elementos de un acordeón: título + su propia lista de bloques
//
// Recursión: este componente usa BlockListEditor, que usa BlockEditor, que usa
// este componente. Los archivos se importan en círculo, así que aquí se usa
// forwardRef(): "la clase existirá cuando haga falta, aunque ahora no esté lista".
//
// Los elementos se reordenan arrastrando (su propia lista del CDK). Los bloques
// de dentro de cada elemento tienen OTRA lista, no conectada con las columnas:
// así no hay dudas de dónde cae lo que sueltas.

import { Component, forwardRef, inject, input, type WritableSignal } from '@angular/core';
import { CdkDrag, type CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { BlockListEditor } from './block-list-editor';
import { EditorState } from './editor-state';
import { type AccordionItemVM, type AccordionVM, emptyAccordionItem, INNER_TYPES, move, moveItem, removeAt } from './model';

@Component({
  selector: 'app-accordion-editor',
  imports: [forwardRef(() => BlockListEditor), CdkDropList, CdkDrag, CdkDragHandle],
  host: { class: 'block' },
  template: `
    @let acc = block();
    <div cdkDropList [cdkDropListData]="acc.items" (cdkDropListDropped)="dropItem($event)" class="space-y-2 p-2">
      @for (it of acc.items(); track it.key; let i = $index) {
        <div cdkDrag [cdkDragData]="it" class="acc-item rounded-md border border-slate-200 bg-slate-50">
          <div class="flex items-center gap-1 px-2 py-1.5" [class.border-b]="!it.collapsed()" [class.border-slate-200]="!it.collapsed()">
            <span cdkDragHandle title="Arrastrar para mover"
                  class="cursor-grab px-1 text-base leading-none text-slate-400 select-none hover:text-slate-700">⠿</span>
            <button type="button" class="icon-btn" title="Plegar / desplegar" [attr.aria-expanded]="!it.collapsed()"
                    (click)="it.collapsed.update(c => !c)">{{ it.collapsed() ? '▸' : '▾' }}</button>
            <input class="acc-title min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 font-semibold focus:border-sky-400 focus:bg-white focus:outline-none"
                   placeholder="Título del elemento"
                   [id]="'title-' + it.key" [value]="it.title()"
                   (input)="it.title.set(val($event))" (keydown.enter)="focusFirst($event, i)" />
            <button type="button" class="icon-btn" title="Subir elemento" (click)="acc.items.update(l => move(l, i, -1))">↑</button>
            <button type="button" class="icon-btn" title="Bajar elemento" (click)="acc.items.update(l => move(l, i, 1))">↓</button>
            <button type="button" class="icon-btn hover:bg-red-100! hover:text-red-700!" title="Eliminar elemento"
                    (click)="acc.items.update(l => removeAt(l, i))">✕</button>
          </div>
          @if (!it.collapsed()) {
            <div class="acc-content py-2 pr-2 pl-6">
              <app-block-list-editor [list]="it.blocks" [allowed]="innerTypes" addLabel="Añadir dentro:" />
            </div>
          }
        </div>
      }
    </div>
    <button type="button" class="acc-add-item btn mx-2 mb-2" (click)="addItem()">+ Añadir elemento</button>
  `,
})
export class AccordionEditor {
  readonly block = input.required<AccordionVM>();
  protected innerTypes = INNER_TYPES;
  protected move = move;
  protected removeAt = removeAt;
  private state = inject(EditorState);

  dropItem(e: CdkDragDrop<WritableSignal<AccordionItemVM[]>>) {
    if (e.previousIndex !== e.currentIndex) this.block().items.update(l => moveItem(l, e.previousIndex, e.currentIndex));
  }

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
