// block-editor.ts — El área de edición de UN bloque, según su tipo
import { Component, input, output } from '@angular/core';
import { RichText } from './rich-text';
import { AccordionEditor } from './accordion-editor';
import { CALLOUT_CLASS } from '../../content/styles-map';
import type { BlockVM } from './model';

@Component({
  selector: 'app-block-editor',
  imports: [RichText, AccordionEditor],
  host: { class: 'block' },
  template: `
    @let b = block();
    @if (b.type === 'paragraph') {
      <app-rich-text [blockId]="b.id" [content]="b.content" [removable]="true"
                     (enter)="enter.emit()" (removeEmpty)="removeEmpty.emit()" />
    }
    @if (b.type === 'heading') {
      <app-rich-text [blockId]="b.id" [content]="b.content" (enter)="enter.emit()"
                     [class]="b.level() === 2 ? 'text-2xl font-bold' : 'text-xl font-semibold'" />
    }
    @if (b.type === 'quote') {
      <app-rich-text [blockId]="b.id" [content]="b.content" (enter)="enter.emit()"
                     class="mx-3 my-2 border-l-4 border-slate-300 italic" />
    }
    @if (b.type === 'callout') {
      <!-- El mismo mapa de colores que el sitio público: el editor se parece al resultado -->
      <app-rich-text [blockId]="b.id" [content]="b.content" (enter)="enter.emit()"
                     class="m-2 rounded-md" [class]="callout[b.tone()]" />
    }
    @if (b.type === 'list') {
      <!-- listStyle es una entrada: al cambiar viñetas/numerada, RichText se repinta -->
      <app-rich-text [blockId]="b.id" [items]="b.items" [listStyle]="b.style()" (enter)="enter.emit()" />
    }
    @if (b.type === 'image') {
      <div class="grid gap-2 p-3">
        <input class="field" placeholder="URL de la imagen (https://...)" [value]="b.url()" (input)="b.url.set(val($event))" />
        <input class="field" placeholder="Texto alternativo (para lectores de pantalla)" [value]="b.alt()" (input)="b.alt.set(val($event))" />
        <input class="field" placeholder="Pie de foto (opcional)" [value]="b.caption()" (input)="b.caption.set(val($event))" />
        @if (b.url().startsWith('http')) { <img class="max-h-40 max-w-60 rounded" [src]="b.url()" alt="" /> }
      </div>
    }
    @if (b.type === 'accordion') {
      <app-accordion-editor [block]="b" />
    }
  `,
})
export class BlockEditor {
  readonly block = input.required<BlockVM>();
  readonly enter = output<void>();
  readonly removeEmpty = output<void>();

  protected callout = CALLOUT_CLASS;
  protected val = (e: Event) => (e.target as HTMLInputElement).value;
}
