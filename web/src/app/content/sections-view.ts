// sections-view.ts — Pinta las secciones de una página
import { Component, input } from '@angular/core';
import { BlockList } from './block-list';
import { BACKGROUND_CLASS, LAYOUT_CLASS } from './styles-map';
import type { Section } from './types';

@Component({
  selector: 'app-sections',
  imports: [BlockList],
  host: { class: 'block' },
  template: `
    @for (s of sections(); track s.id) {
      <!-- El fondo ocupa todo el ancho; el contenido se centra dentro -->
      <section class="py-8 md:py-12" [class]="backgrounds[s.background]" [id]="'s-' + s.id">
        <div class="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-4 md:gap-8" [class]="layouts[s.layout]">
          @for (c of s.columns; track $index) {
            <div class="prose prose-brand max-w-none min-w-0">
              <app-blocks [blocks]="c.blocks" />
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class SectionsView {
  readonly sections = input.required<Section[]>();
  protected layouts = LAYOUT_CLASS;
  protected backgrounds = BACKGROUND_CLASS;
}
