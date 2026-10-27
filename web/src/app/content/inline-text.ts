// inline-text.ts — Pinta una lista de spans: texto con formato y enlaces
//
// El HTML lo genera spansToHtml() a partir del registro de formatos (marks.ts).
// Es seguro meterlo con [innerHTML] por dos razones:
//   1. spansToHtml escapa todo el texto: solo genera etiquetas que conocemos
//   2. Angular, además, limpia (sanitiza) cualquier cosa que se pase a innerHTML:
//      un <script> o un href="javascript:..." desaparecerían igualmente
// Y antes de todo eso, la API ya validó el contenido. Tres capas.

import { Component, computed, input } from '@angular/core';
import { spansToHtml } from './inline-html';
import type { Span } from './types';

@Component({
  selector: 'app-inline',
  template: '',
  host: { '[innerHTML]': 'html()' },
})
export class InlineText {
  readonly spans = input.required<Span[]>();
  protected html = computed(() => spansToHtml(this.spans()));
}
