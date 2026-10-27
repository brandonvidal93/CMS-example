// block-list-editor.ts — Una lista de bloques editable (y una zona donde soltar bloques)
//
// Se usa en TRES sitios, con distintas opciones:
//   - el cuerpo de un artículo         allowed = todos
//   - el interior de un acordeón        allowed = todos menos acordeón
//   - una columna de una página         allowed = todos, conectada a las demás columnas
//
// Arrastrar y soltar (Angular CDK):
//   cdkDropList  = una zona donde se pueden soltar elementos
//   cdkDrag      = un elemento arrastrable
//   cdkDragHandle = la "agarradera": solo se arrastra desde ahí (si no, no se
//                   podría seleccionar texto dentro del bloque)
// El CDK no toca nuestros datos: nos avisa con (cdkDropListDropped) y nosotros
// actualizamos las señales. Angular repinta y el bloque aparece en su sitio nuevo.

import { Component, computed, inject, input, type WritableSignal } from '@angular/core';
import { CdkDrag, type CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import type { BlockType } from '../../content/types';
import { BlockEditor } from './block-editor';
import { EditorState } from './editor-state';
import { type BlockVM, emptyBlock, insertAt, isBlockVM, LABELS, move, moveItem, newId, removeAt } from './model';

@Component({
  selector: 'app-block-list-editor',
  imports: [BlockEditor, CdkDropList, CdkDrag, CdkDragHandle],
  host: { class: 'block' },
  template: `
    <div cdkDropList
         [id]="dropId()"
         [cdkDropListData]="list()"
         [cdkDropListConnectedTo]="connectedTo()"
         [cdkDropListEnterPredicate]="canEnter"
         (cdkDropListDropped)="drop($event)"
         class="min-h-10 space-y-2">
      @for (b of blocks(); track b.id; let i = $index) {
        <div cdkDrag [cdkDragData]="b" [attr.data-type]="b.type"
             class="block-item rounded-md border border-slate-200 bg-white focus-within:border-sky-400">
          <div class="flex flex-wrap items-center gap-1.5 rounded-t-md border-b border-slate-100 bg-slate-50 px-2 py-1 text-xs">
            <span cdkDragHandle title="Arrastrar para mover" aria-label="Arrastrar para mover"
                  class="cursor-grab px-1 text-base leading-none text-slate-400 select-none hover:text-slate-700 active:cursor-grabbing">⠿</span>
            <span class="font-semibold text-slate-600">{{ labels[b.type] }}</span>

            @if (b.type === 'heading') {
              <select aria-label="Nivel" class="rounded border border-slate-300 bg-white px-1 py-0.5"
                      (change)="b.level.set(num($event) === 3 ? 3 : 2)">
                <option value="2" [selected]="b.level() === 2">H2</option>
                <option value="3" [selected]="b.level() === 3">H3</option>
              </select>
            }
            @if (b.type === 'list') {
              <select aria-label="Estilo" class="rounded border border-slate-300 bg-white px-1 py-0.5"
                      (change)="b.style.set(val($event) === 'number' ? 'number' : 'bullet')">
                <option value="bullet" [selected]="b.style() === 'bullet'">• Viñetas</option>
                <option value="number" [selected]="b.style() === 'number'">1. Numerada</option>
              </select>
            }
            @if (b.type === 'callout') {
              <select aria-label="Tono" class="rounded border border-slate-300 bg-white px-1 py-0.5"
                      (change)="b.tone.set(val($event) === 'warning' ? 'warning' : 'info')">
                <option value="info" [selected]="b.tone() === 'info'">Información</option>
                <option value="warning" [selected]="b.tone() === 'warning'">Atención</option>
              </select>
            }

            <span class="flex-1"></span>
            <!-- ↑ ↓ siguen ahí: arrastrar no funciona con teclado, y esto sí -->
            <button type="button" class="icon-btn" title="Subir" (click)="list().update(l => move(l, i, -1))">↑</button>
            <button type="button" class="icon-btn" title="Bajar" (click)="list().update(l => move(l, i, 1))">↓</button>
            <button type="button" class="icon-btn hover:bg-red-100! hover:text-red-700!" title="Eliminar"
                    (click)="list().update(l => removeAt(l, i))">✕</button>
          </div>

          <app-block-editor [block]="b" (enter)="add('paragraph', i + 1)" (removeEmpty)="removeEmpty(i)" />
        </div>
      } @empty {
        @if (emptyText()) { <p class="py-4 text-center text-sm text-slate-400">{{ emptyText() }}</p> }
      }
    </div>

    <div class="add-bar mt-2 flex flex-wrap items-center gap-1 text-xs text-slate-500">
      {{ addLabel() }}
      @for (t of allowed(); track t) {
        <button type="button" (click)="add(t)"
                class="rounded border border-dashed border-slate-300 px-2 py-0.5 hover:border-slate-500 hover:text-slate-800">+ {{ labels[t] }}</button>
      }
    </div>
  `,
})
export class BlockListEditor {
  readonly list = input.required<WritableSignal<BlockVM[]>>();
  readonly allowed = input.required<BlockType[]>();
  readonly addLabel = input('Añadir:');
  readonly emptyText = input('');
  // Para conectar listas entre sí (las columnas de una página)
  readonly listId = input<string>();
  readonly connectedTo = input<string[]>([]);

  protected blocks = computed(() => this.list()());
  protected dropId = computed(() => this.listId() ?? 'list-' + this.fallbackId);
  private fallbackId = newId();
  protected labels = LABELS;
  protected move = move;
  protected removeAt = removeAt;
  private state = inject(EditorState);

  // ¿Puede entrar este elemento en ESTA lista? Las mismas reglas del esquema:
  // dentro de un acordeón no se acepta otro acordeón (allowed no lo incluye).
  // Es una función flecha para que "this" funcione cuando la llame el CDK.
  canEnter = (drag: CdkDrag): boolean => isBlockVM(drag.data) && this.allowed().includes(drag.data.type);

  drop(e: CdkDragDrop<WritableSignal<BlockVM[]>, WritableSignal<BlockVM[]>, BlockVM>) {
    if (e.previousContainer === e.container) {
      // Misma lista: solo cambia el orden
      if (e.previousIndex !== e.currentIndex) this.list().update(l => moveItem(l, e.previousIndex, e.currentIndex));
    } else {
      // De otra lista (otra columna): se quita de allí y se inserta aquí
      const block = e.item.data;
      e.previousContainer.data.update(l => l.filter(x => x !== block));
      this.list().update(l => insertAt(l, e.currentIndex, block));
    }
  }

  // Añadir un bloque en la posición dada (por defecto, al final) y darle el foco
  add(type: BlockType, at = this.blocks().length) {
    const block = emptyBlock(type);
    this.list().update(l => insertAt(l, at, block));
    if (block.type === 'accordion') this.state.focusElement('title-' + block.items()[0].key);
    else this.state.focus(block.id);
  }

  // Retroceso en un párrafo vacío: se borra y el foco vuelve al bloque anterior
  removeEmpty(i: number) {
    if (i === 0) return;
    const prev = this.blocks()[i - 1];
    this.list().update(l => removeAt(l, i));
    this.state.focus(prev.id);
  }

  protected val = (e: Event) => (e.target as HTMLSelectElement).value;
  protected num = (e: Event) => Number(this.val(e));
}
