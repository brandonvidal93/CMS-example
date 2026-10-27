// block-editor.ts — El área de edición de UN bloque, según su tipo
import { Component, input, output } from '@angular/core';
import { RichText } from './rich-text';
import { AccordionEditor } from './accordion-editor';
import type { BlockVM } from './model';

@Component({
  selector: 'app-block-editor',
  imports: [RichText, AccordionEditor],
  template: `
    @let b = block();
    @if (b.type === 'paragraph' || b.type === 'quote' || b.type === 'heading' || b.type === 'callout') {
      <app-rich-text
        [blockId]="b.id"
        [content]="b.content"
        [removable]="b.type === 'paragraph'"
        (enter)="enter.emit()"
        (removeEmpty)="removeEmpty.emit()" />
    }
    @if (b.type === 'list') {
      <!-- listStyle es una entrada: al cambiar viñetas/numerada, RichText se repinta -->
      <app-rich-text [blockId]="b.id" [items]="b.items" [listStyle]="b.style()" (enter)="enter.emit()" />
    }
    @if (b.type === 'image') {
      <div class="image-fields">
        <input placeholder="URL de la imagen (https://...)" [value]="b.url()" (input)="b.url.set(val($event))" />
        <input placeholder="Texto alternativo (para lectores de pantalla)" [value]="b.alt()" (input)="b.alt.set(val($event))" />
        <input placeholder="Pie de foto (opcional)" [value]="b.caption()" (input)="b.caption.set(val($event))" />
        @if (b.url().startsWith('http')) { <img class="image-preview" [src]="b.url()" alt="" /> }
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

  protected val = (e: Event) => (e.target as HTMLInputElement).value;
}
