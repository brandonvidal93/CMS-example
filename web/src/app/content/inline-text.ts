// inline-text.ts — Pinta una lista de spans: texto con negrita, cursiva y enlaces
//
// Es el equivalente de la función inline() de render-html.js, pero sin escapar
// nada a mano: Angular escapa SIEMPRE el texto de {{ }}, y además revisa los
// [href] (un "javascript:..." se convertiría en "unsafe:javascript:...").
// Es una segunda capa de protección, además de la validación de la API.
//
// Ojo con los espacios: en las plantillas no hay espacios ni saltos alrededor de
// {{ }}, porque Angular los convertiría en espacios visibles entre los spans.

import { Component, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { Span } from './types';

@Component({
  selector: 'app-inline',
  imports: [NgTemplateOutlet],
  template: `@for (s of spans(); track $index) {@if (s.href) {<a [href]="s.href"><ng-container [ngTemplateOutlet]="fmt" [ngTemplateOutletContext]="{ $implicit: s }" /></a>} @else {<ng-container [ngTemplateOutlet]="fmt" [ngTemplateOutletContext]="{ $implicit: s }" />}}
<ng-template #fmt let-s>@if (s.marks.includes('bold') && s.marks.includes('italic')) {<strong><em><ng-container [ngTemplateOutlet]="txt" [ngTemplateOutletContext]="{ $implicit: s.text }" /></em></strong>} @else if (s.marks.includes('bold')) {<strong><ng-container [ngTemplateOutlet]="txt" [ngTemplateOutletContext]="{ $implicit: s.text }" /></strong>} @else if (s.marks.includes('italic')) {<em><ng-container [ngTemplateOutlet]="txt" [ngTemplateOutletContext]="{ $implicit: s.text }" /></em>} @else {<ng-container [ngTemplateOutlet]="txt" [ngTemplateOutletContext]="{ $implicit: s.text }" />}</ng-template>
<ng-template #txt let-t>@for (line of t.split('\n'); track $index) {@if (!$first) {<br />}{{ line }}}</ng-template>`,
})
export class InlineText {
  readonly spans = input.required<Span[]>();
}
