// sections-editor.ts — Secciones con columnas (solo páginas)
import { Component, inject, input, type WritableSignal } from '@angular/core';
import type { Layout } from '../../content/types';
import { BlockListEditor } from './block-list-editor';
import { EditorState } from './editor-state';
import {
  ALL_TYPES, BACKGROUNDS, type ColumnVM, emptyBlock, emptyColumn, emptySection,
  LAYOUT_KEYS, LAYOUTS, move, removeAt, type SectionVM,
} from './model';

@Component({
  selector: 'app-sections-editor',
  imports: [BlockListEditor],
  template: `
    @for (s of sections()(); track s.id; let si = $index) {
      <div class="section-ed" [attr.data-background]="s.background()">
        <div class="section-bar">
          <span class="section-label">Sección</span>
          <span class="layout-pick" role="group" aria-label="Columnas">
            @for (key of layoutKeys; track key) {
              <button type="button" [attr.aria-pressed]="s.layout() === key" [title]="'Layout ' + key"
                      (click)="changeLayout(s, key)">{{ layouts[key].label }}</button>
            }
          </span>
          <label>Fondo:
            <select (change)="s.background.set($any(val($event)))">
              @for (bg of backgrounds; track bg[0]) {
                <option [value]="bg[0]" [selected]="s.background() === bg[0]">{{ bg[1] }}</option>
              }
            </select>
          </label>
          <span class="spacer"></span>
          <button type="button" title="Subir sección" (click)="sections().update(l => move(l, si, -1))">↑</button>
          <button type="button" title="Bajar sección" (click)="sections().update(l => move(l, si, 1))">↓</button>
          <button type="button" title="Eliminar sección" (click)="remove(si)">✕</button>
        </div>

        <!-- En el editor también previsualizamos las proporciones de las columnas -->
        <div class="columns" [style.grid-template-columns]="layouts[s.layout()].grid">
          @for (col of s.columns(); track col.key; let ci = $index) {
            <div class="column-ed">
              <div class="column-label">Columna {{ ci + 1 }}</div>
              <app-block-list-editor [list]="col.blocks" [allowed]="allTypes" [inColumn]="true"
                                     (moveX)="moveX(s, ci, $event.index, $event.dir)" />
            </div>
          }
        </div>
      </div>
    }

    <div class="add-section">Añadir sección:
      @for (key of layoutKeys; track key) {
        <button type="button" (click)="addSection(key)">[ {{ layouts[key].label }} ]</button>
      }
    </div>
  `,
})
export class SectionsEditor {
  readonly sections = input.required<WritableSignal<SectionVM[]>>();

  protected layouts = LAYOUTS;
  protected layoutKeys = LAYOUT_KEYS;
  protected backgrounds = BACKGROUNDS;
  protected allTypes = ALL_TYPES;
  protected move = move;
  private state = inject(EditorState);

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

  // ← → : el bloque pasa al final de la columna vecina
  moveX(s: SectionVM, ci: number, index: number, dir: -1 | 1) {
    const cols = s.columns();
    const target = cols[ci + dir];
    if (!target) return;
    const block = cols[ci].blocks()[index];
    cols[ci].blocks.update(l => removeAt(l, index));
    target.blocks.update(l => [...l, block]);
  }

  protected val = (e: Event) => (e.target as HTMLSelectElement).value;
}
