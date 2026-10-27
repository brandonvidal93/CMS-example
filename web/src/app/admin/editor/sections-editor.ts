// sections-editor.ts — Secciones con columnas (solo páginas)
//
// Arrastrar y soltar en dos niveles:
//   - las secciones se reordenan entre sí (una lista del CDK)
//   - los bloques se mueven entre TODAS las columnas de la página: cada columna
//     es una lista con un id, y todas se declaran conectadas (connectedTo)

import { Component, computed, inject, input, type WritableSignal } from '@angular/core';
import { CdkDrag, type CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import type { Background, Layout } from '../../content/types';
import { BlockListEditor } from './block-list-editor';
import { EditorState } from './editor-state';
import {
  ALL_TYPES, BACKGROUNDS, type ColumnVM, emptyBlock, emptyColumn, emptySection,
  LAYOUT_KEYS, LAYOUTS, move, moveItem, removeAt, type SectionVM,
} from './model';

// Cómo se ve cada fondo EN EL EDITOR (una pista visual, no el diseño final)
const BG_EDITOR: Record<Background, string> = {
  none: 'border-slate-300 bg-slate-50',
  light: 'border-brand-200 bg-brand-50',
  accent: 'border-brand-700 bg-brand-100',
};

@Component({
  selector: 'app-sections-editor',
  imports: [BlockListEditor, CdkDropList, CdkDrag, CdkDragHandle],
  host: { class: 'block' },
  template: `
    <div cdkDropList [cdkDropListData]="sections()" (cdkDropListDropped)="dropSection($event)" class="space-y-4">
      @for (s of sections()(); track s.id; let si = $index) {
        <div cdkDrag [cdkDragData]="s" class="section-ed rounded-lg border-2" [class]="bgEditor[s.background()]">
          <div class="section-bar flex flex-wrap items-center gap-2 border-b border-black/10 px-3 py-1.5 text-sm">
            <span cdkDragHandle title="Arrastrar sección"
                  class="cursor-grab px-1 text-lg leading-none text-slate-400 select-none hover:text-slate-700">⠿</span>
            <span class="font-bold text-slate-700">Sección</span>
            <span class="inline-flex gap-1" role="group" aria-label="Columnas">
              @for (key of layoutKeys; track key) {
                <button type="button" [attr.aria-pressed]="s.layout() === key" [title]="'Layout ' + key"
                        class="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-xs aria-pressed:border-slate-800 aria-pressed:bg-slate-800 aria-pressed:text-white"
                        (click)="changeLayout(s, key)">{{ layouts[key].label }}</button>
              }
            </span>
            <label class="text-slate-600">Fondo:
              <select class="rounded border border-slate-300 bg-white px-1 py-0.5" (change)="s.background.set($any(val($event)))">
                @for (bg of backgrounds; track bg[0]) {
                  <option [value]="bg[0]" [selected]="s.background() === bg[0]">{{ bg[1] }}</option>
                }
              </select>
            </label>
            <span class="flex-1"></span>
            <button type="button" class="icon-btn" title="Subir sección" (click)="sections().update(l => move(l, si, -1))">↑</button>
            <button type="button" class="icon-btn" title="Bajar sección" (click)="sections().update(l => move(l, si, 1))">↓</button>
            <button type="button" class="icon-btn hover:bg-red-100! hover:text-red-700!" title="Eliminar sección" (click)="remove(si)">✕</button>
          </div>

          <!-- En el editor también previsualizamos las proporciones de las columnas -->
          <div class="grid gap-3 p-3" [style.grid-template-columns]="layouts[s.layout()].grid">
            @for (col of s.columns(); track col.key; let ci = $index) {
              <div class="column-ed min-w-0 rounded-md border border-dashed border-slate-300 bg-white/70 p-2">
                <div class="mb-1 text-[11px] tracking-wide text-slate-400 uppercase">Columna {{ ci + 1 }}</div>
                <app-block-list-editor [list]="col.blocks" [allowed]="allTypes"
                                       [listId]="'col-' + col.key" [connectedTo]="columnIds()"
                                       emptyText="Columna vacía · arrastra un bloque aquí" />
              </div>
            }
          </div>
        </div>
      }
    </div>

    <div class="add-section mt-4 flex flex-wrap items-center gap-1 text-sm text-slate-500">Añadir sección:
      @for (key of layoutKeys; track key) {
        <button type="button" class="btn font-mono" (click)="addSection(key)">[ {{ layouts[key].label }} ]</button>
      }
    </div>
  `,
})
export class SectionsEditor {
  readonly sections = input.required<WritableSignal<SectionVM[]>>();

  // Los ids de TODAS las columnas: cada columna se conecta con todas las demás
  protected columnIds = computed(() => this.sections()().flatMap(s => s.columns().map(c => 'col-' + c.key)));

  protected layouts = LAYOUTS;
  protected layoutKeys = LAYOUT_KEYS;
  protected backgrounds = BACKGROUNDS;
  protected bgEditor = BG_EDITOR;
  protected allTypes = ALL_TYPES;
  protected move = move;
  private state = inject(EditorState);

  dropSection(e: CdkDragDrop<WritableSignal<SectionVM[]>>) {
    if (e.previousIndex !== e.currentIndex) this.sections().update(l => moveItem(l, e.previousIndex, e.currentIndex));
  }

  addSection(layout: Layout) {
    const s = emptySection(layout);
    const first = emptyBlock('paragraph');
    s.columns()[0].blocks.set([first]); // para empezar a escribir enseguida
    this.sections().update(l => [...l, s]);
    this.state.focus(first.id);
  }

  remove(i: number) {
    const s = this.sections()()[i];
    const hasContent = s.columns().some(c => c.blocks().length > 0);
    if (!hasContent || confirm('¿Eliminar esta sección y todo su contenido?')) {
      this.sections().update(l => removeAt(l, i));
    }
  }

  // Cambiar el layout cambia el NÚMERO de columnas. Regla: nunca perder contenido.
  //   - si hacen falta más columnas, se añaden vacías
  //   - si sobran, sus bloques pasan al final de la última columna que queda
  changeLayout(s: SectionVM, layout: Layout) {
    const wanted = LAYOUTS[layout].cols;
    const cols = s.columns();
    let next: ColumnVM[];
    if (cols.length <= wanted) {
      next = [...cols, ...Array.from({ length: wanted - cols.length }, () => emptyColumn())];
    } else {
      next = cols.slice(0, wanted);
      const overflow = cols.slice(wanted).flatMap(c => c.blocks());
      next[wanted - 1].blocks.update(b => [...b, ...overflow]);
    }
    s.columns.set(next);
    s.layout.set(layout);
  }

  protected val = (e: Event) => (e.target as HTMLSelectElement).value;
}
