// sections-view.ts — Pinta las secciones de una página (versión Angular de render-page.js)
//
// Igual que antes, aquí se traduce la INTENCIÓN guardada ("1/3+2/3") a una
// clase CSS, y el tema (styles/theme.css) decide qué significa visualmente.

import { Component, input } from '@angular/core';
import { BlockList } from './block-list';
import type { Layout, Section } from './types';

const LAYOUT_CLASS: Record<Layout, string> = {
  '1': 'layout-1',
  '1/2+1/2': 'layout-half-half',
  '1/3+2/3': 'layout-third-twothirds',
  '2/3+1/3': 'layout-twothirds-third',
  '1/3+1/3+1/3': 'layout-thirds',
};

@Component({
  selector: 'app-sections',
  imports: [BlockList],
  template: `
    @for (s of sections(); track s.id) {
      <section class="section" [class]="'bg-' + s.background" [id]="'s-' + s.id">
        <div class="section-inner" [class]="layoutClass(s.layout)">
          @for (c of s.columns; track $index) {
            <div class="column content"><app-blocks [blocks]="c.blocks" /></div>
          }
        </div>
      </section>
    }
  `,
})
export class SectionsView {
  readonly sections = input.required<Section[]>();
  layoutClass = (l: Layout) => LAYOUT_CLASS[l] ?? 'layout-1';
}
