// block-list.ts — Pinta una lista de bloques
//
// La tipografía (márgenes de párrafos, tamaño de títulos, viñetas, citas...) NO
// está aquí: la pone la clase "prose" del contenedor (artículo o columna).
// Aquí solo se estilan los bloques que prose no conoce: el aviso y el acordeón.
//
// Para el acordeón, el componente se usa a sí mismo (<app-blocks> dentro de
// <app-blocks>): la misma recursión que en el esquema.

import { Component, input } from '@angular/core';
import { InlineText } from './inline-text';
import { CALLOUT_CLASS } from './styles-map';
import type { Block } from './types';

@Component({
  selector: 'app-blocks',
  imports: [InlineText],
  host: { class: 'block' },
  template: `
    @for (b of blocks(); track b.id) {
      @switch (b.type) {
        @case ('paragraph') { <p><app-inline [spans]="b.content" /></p> }
        @case ('heading') {
          @if (b.level === 2) { <h2><app-inline [spans]="b.content" /></h2> }
          @else { <h3><app-inline [spans]="b.content" /></h3> }
        }
        @case ('quote') { <blockquote><app-inline [spans]="b.content" /></blockquote> }
        @case ('list') {
          @if (b.style === 'number') {
            <ol>@for (it of b.items; track $index) { <li><app-inline [spans]="it" /></li> }</ol>
          } @else {
            <ul>@for (it of b.items; track $index) { <li><app-inline [spans]="it" /></li> }</ul>
          }
        }
        @case ('image') {
          <figure>
            <img [src]="b.url" [alt]="b.alt" loading="lazy" class="rounded-md" />
            @if (b.caption) { <figcaption>{{ b.caption }}</figcaption> }
          </figure>
        }
        @case ('callout') {
          <aside class="my-5 block rounded-md px-4 py-3" [class]="callout[b.tone]">
            <app-inline [spans]="b.content" />
          </aside>
        }
        @case ('accordion') {
          <!-- <details>/<summary>: acordeón nativo, funciona incluso antes de que cargue JavaScript.
               "group" + "group-open:" = estilos según si el <details> está abierto -->
          <div class="my-6 divide-y divide-brand-200 rounded-lg border border-brand-200 in-[.section-accent]:divide-white/30 in-[.section-accent]:border-white/40">
            @for (it of b.items; track $index) {
              <details class="group">
                <summary class="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-bold text-brand-700 in-[.section-accent]:text-white [&::-webkit-details-marker]:hidden">
                  {{ it.title }}
                  <span aria-hidden="true" class="font-normal transition-transform group-open:rotate-45">+</span>
                </summary>
                <div class="px-4 pb-3"><app-blocks [blocks]="it.blocks" /></div>
              </details>
            }
          </div>
        }
        <!-- Un tipo que este frontend no conoce simplemente no se pinta -->
      }
    }
  `,
})
export class BlockList {
  readonly blocks = input.required<Block[]>();
  protected callout = CALLOUT_CLASS;
}
