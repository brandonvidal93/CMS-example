// block-list-editor.ts — Una lista de bloques editable
//
// Se usa en TRES sitios, con distintas opciones:
//   - el cuerpo de un artículo         allowed = todos
//   - el interior de un acordeón        allowed = todos menos acordeón
//   - una columna de una página         allowed = todos, inColumn = true (← →)
//
// Recibe la SEÑAL de la lista (no la lista): así puede reemplazarla con
// list.update(...) y Angular repinta solo lo que cambió.

import { Component, computed, inject, input, output, type WritableSignal } from '@angular/core';
import type { BlockType } from '../../content/types';
import { BlockEditor } from './block-editor';
import { EditorState } from './editor-state';
import { type BlockVM, emptyBlock, insertAt, LABELS, move, removeAt } from './model';

@Component({
  selector: 'app-block-list-editor',
  imports: [BlockEditor],
  template: `
    <div class="blocks-list">
      @for (b of blocks(); track b.id; let i = $index) {
        <div class="block" [attr.data-type]="b.type">
          <div class="block-bar">
            <span class="block-label">{{ labels[b.type] }}</span>

            <!-- Opciones propias de algunos tipos -->
            @if (b.type === 'heading') {
              <select aria-label="Nivel" (change)="b.level.set(num($event) === 3 ? 3 : 2)">
                <option value="2" [selected]="b.level() === 2">H2</option>
                <option value="3" [selected]="b.level() === 3">H3</option>
              </select>
            }
            @if (b.type === 'list') {
              <select aria-label="Estilo" (change)="b.style.set(val($event) === 'number' ? 'number' : 'bullet')">
                <option value="bullet" [selected]="b.style() === 'bullet'">• Viñetas</option>
                <option value="number" [selected]="b.style() === 'number'">1. Numerada</option>
              </select>
            }
            @if (b.type === 'callout') {
              <select aria-label="Tono" (change)="b.tone.set(val($event) === 'warning' ? 'warning' : 'info')">
                <option value="info" [selected]="b.tone() === 'info'">Información</option>
                <option value="warning" [selected]="b.tone() === 'warning'">Atención</option>
              </select>
            }

            <span class="spacer"></span>
            @if (inColumn()) {
              <button type="button" title="Mover a la columna de la izquierda" (click)="moveX.emit({ index: i, dir: -1 })">←</button>
              <button type="button" title="Mover a la columna de la derecha" (click)="moveX.emit({ index: i, dir: 1 })">→</button>
            }
            <button type="button" title="Subir" (click)="list().update(l => move(l, i, -1))">↑</button>
            <button type="button" title="Bajar" (click)="list().update(l => move(l, i, 1))">↓</button>
            <button type="button" title="Eliminar" (click)="list().update(l => removeAt(l, i))">✕</button>
          </div>

          <app-block-editor [block]="b" (enter)="add('paragraph', i + 1)" (removeEmpty)="removeEmpty(i)" />
        </div>
      } @empty {
        @if (inColumn()) { <p class="column-empty">Columna vacía</p> }
      }
    </div>

    <div class="add-bar">
      {{ addLabel() }}
      @for (t of allowed(); track t) {
        <button type="button" (click)="add(t)">+ {{ labels[t] }}</button>
      }
    </div>
  `,
})
export class BlockListEditor {
  readonly list = input.required<WritableSignal<BlockVM[]>>();
  readonly allowed = input.required<BlockType[]>();
  readonly inColumn = input(false);
  readonly addLabel = input('Añadir:');
  readonly moveX = output<{ index: number; dir: -1 | 1 }>();

  protected blocks = computed(() => this.list()());
  protected labels = LABELS;
  protected move = move;
  protected removeAt = removeAt;
  private state = inject(EditorState);

  // Añadir un bloque en la posición dada (por defecto, al final) y darle el foco
  add(type: BlockType, at = this.blocks().length) {
    const block = emptyBlock(type);
    this.list().update(l => insertAt(l, at, block));
    // Un acordeón nuevo empieza por el título de su primer elemento
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
