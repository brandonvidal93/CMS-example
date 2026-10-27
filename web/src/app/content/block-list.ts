// block-list.ts — Pinta una lista de bloques (versión Angular de render-html.js)
//
// Un @switch por tipo de bloque. Para el acordeón, el componente se usa a SÍ
// MISMO (<app-blocks> dentro de <app-blocks>): es la misma recursión que en el
// esquema, ahora en la plantilla. Un componente standalone puede referenciarse
// a sí mismo sin importarse.

import { Component, input } from '@angular/core';
import { InlineText } from './inline-text';
import type { Block } from './types';

@Component({
  selector: 'app-blocks',
  imports: [InlineText],
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
            <img [src]="b.url" [alt]="b.alt" loading="lazy" />
            @if (b.caption) { <figcaption>{{ b.caption }}</figcaption> }
          </figure>
        }
        @case ('callout') {
          <aside class="callout" [class]="'callout-' + b.tone"><app-inline [spans]="b.content" /></aside>
        }
        @case ('accordion') {
          <!-- <details>/<summary>: acordeón nativo, funciona incluso antes de que cargue JavaScript -->
          <div class="accordion">
            @for (it of b.items; track $index) {
              <details>
                <summary>{{ it.title }}</summary>
                <div class="accordion-body"><app-blocks [blocks]="it.blocks" /></div>
              </details>
            }
          </div>
        }
        <!-- Un tipo que este frontend no conoce (p. ej. uno nuevo en la API) simplemente no se pinta -->
      }
    }
  `,
})
export class BlockList {
  readonly blocks = input.required<Block[]>();
}
