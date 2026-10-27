// editor-page.ts — La pantalla de edición de un artículo o una página
//
// Rutas: /admin/articles/new, /admin/articles/5, /admin/pages/new, /admin/pages/3
// "type" llega desde data de la ruta, "id" desde el parámetro :id.

import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AdminApi, type ContentItem } from '../../core/api';
import type { ArticleDoc, ContentType, PageDoc, Status } from '../../content/types';
import { BlockListEditor } from './block-list-editor';
import { SectionsEditor } from './sections-editor';
import { EditorState } from './editor-state';
import {
  ALL_TYPES, articleToDoc, blockFromDoc, type BlockVM, emptyBlock, emptySection, pageToDoc,
  sectionFromDoc, type SectionVM,
} from './model';

@Component({
  selector: 'app-editor-page',
  imports: [RouterLink, BlockListEditor, SectionsEditor],
  providers: [EditorState], // un EditorState por cada editor abierto
  template: `
    <p><a routerLink="/admin">← Volver</a> · Editando {{ isPage() ? 'una página' : 'un artículo' }}
      @if (dirty()) { <span class="dirty">· Cambios sin guardar</span> }
    </p>

    @if (loadError()) { <p class="errors">{{ loadError() }}</p> }
    @if (errors().length) {
      <ul class="errors">@for (e of errors(); track $index) { <li>{{ e }}</li> }</ul>
    }
    @if (savedMessage()) { <p class="ok">{{ savedMessage() }}</p> }

    @if (ready()) {
      <input class="title" placeholder="Título" [value]="title()" (input)="title.set(val($event))" />

      <!-- mousedown.preventDefault: que el botón no le robe la selección al texto -->
      <div class="toolbar">
        <button type="button" (mousedown)="$event.preventDefault()" (click)="format('bold')"><b>N</b></button>
        <button type="button" (mousedown)="$event.preventDefault()" (click)="format('italic')"><i>K</i></button>
        <button type="button" (mousedown)="$event.preventDefault()" (click)="link()">Enlace</button>
        <button type="button" (mousedown)="$event.preventDefault()" (click)="format('unlink')">Quitar enlace</button>
      </div>

      @if (isPage()) {
        <app-sections-editor [sections]="sections" />
      } @else {
        <app-block-list-editor [list]="blocks" [allowed]="allTypes" />
      }

      <div class="actions">
        <button type="button" [disabled]="saving()" (click)="save('draft')">Guardar borrador</button>
        <button type="button" [disabled]="saving()" (click)="save('published')">Publicar</button>
        @if (status()) { Estado actual: <b>{{ status() === 'published' ? 'Publicado' : 'Borrador' }}</b> }
        @if (status() === 'published') {
          · <a [href]="publicUrl()" target="_blank">Ver en el sitio</a>
          · <a [href]="'/api/' + type() + '/' + slug()" target="_blank">JSON</a>
          · <a [href]="'/api/' + type() + '/' + slug() + '/markdown'" target="_blank">Markdown</a>
        }
      </div>

      <details class="json-preview"><summary>¿Qué JSON se va a enviar?</summary><pre>{{ json() }}</pre></details>
    }
  `,
})
export class EditorPage implements OnInit {
  readonly type = input.required<ContentType>();
  readonly id = input<string>();

  private api = inject(AdminApi);
  private router = inject(Router);

  // ── El documento, como señales ──
  protected blocks = signal<BlockVM[]>([]);     // artículo
  protected sections = signal<SectionVM[]>([]); // página
  protected title = signal('');

  // ── Estado de la pantalla ──
  protected status = signal<Status | null>(null);
  protected slug = signal('');
  protected ready = signal(false);
  protected saving = signal(false);
  protected errors = signal<string[]>([]);
  protected loadError = signal('');
  protected savedMessage = signal('');
  private savedJson = signal('');

  protected allTypes = ALL_TYPES;
  protected isPage = computed(() => this.type() === 'pages');
  protected publicUrl = computed(() => (this.isPage() ? `/${this.slug()}` : `/blog/${this.slug()}`));

  // El documento que se enviaría AHORA. Lee todas las señales del modelo, así que
  // se recalcula solo con cada cambio: no hace falta "avisar" de nada.
  protected doc = computed<ArticleDoc | PageDoc>(() =>
    this.isPage() ? pageToDoc(this.sections()) : articleToDoc(this.blocks()));
  protected json = computed(() => JSON.stringify(this.doc(), null, 2));

  // Cambios sin guardar = lo que hay ahora es distinto de lo último guardado
  protected dirty = computed(() =>
    this.ready() && JSON.stringify({ t: this.title(), d: this.doc() }) !== this.savedJson());

  ngOnInit() {
    const id = this.id();
    if (!id) {
      // Nuevo: un párrafo vacío (artículo) o una sección de una columna (página)
      if (this.isPage()) {
        const s = emptySection('1');
        s.columns()[0].blocks.set([emptyBlock('paragraph')]);
        this.sections.set([s]);
      } else {
        this.blocks.set([emptyBlock('paragraph')]);
      }
      this.markSaved();
      this.ready.set(true);
      return;
    }

    this.api.get(this.type(), Number(id)).subscribe({
      next: ({ data }) => this.load(data),
      error: (e: HttpErrorResponse) => this.loadError.set(e.status === 404 ? 'No existe.' : 'No se pudo cargar (¿está arrancada la API?).'),
    });

    // Mensaje que deja save() al crear (ver navigate(...) más abajo)
    if (history.state?.saved) this.savedMessage.set('Guardado.');
  }

  // JSON de la API -> modelo de señales
  private load(item: ContentItem) {
    this.title.set(item.title);
    this.status.set(item.status);
    this.slug.set(item.slug);
    if ('sections' in item.content) this.sections.set(item.content.sections.map(sectionFromDoc));
    else this.blocks.set(item.content.blocks.map(blockFromDoc));
    this.markSaved();
    this.ready.set(true);
  }

  private markSaved() {
    this.savedJson.set(JSON.stringify({ t: this.title(), d: this.doc() }));
  }

  save(status: Status) {
    this.saving.set(true);
    this.errors.set([]);
    this.savedMessage.set('');
    const id = this.id() ? Number(this.id()) : null;

    this.api.save(this.type(), id, { title: this.title(), status, content: this.doc() }).subscribe({
      next: ({ data }) => {
        this.saving.set(false);
        if (id === null) {
          // Recién creado: pasamos a su URL definitiva (/admin/articles/7)
          this.router.navigate(['/admin', this.type(), data.id], { replaceUrl: true, state: { saved: true } });
          return;
        }
        // Recargamos el modelo con lo que devolvió la API: es la versión LIMPIA
        // (ids asignados, spans unidos, bloques vacíos eliminados)
        this.load(data);
        this.savedMessage.set(status === 'published' ? 'Publicado.' : 'Borrador guardado.');
      },
      error: (e: HttpErrorResponse) => {
        this.saving.set(false);
        this.errors.set(e.status === 422 && Array.isArray(e.error?.errors) ? e.error.errors : ['No se pudo guardar.']);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    });
  }

  // La barra de formato actúa sobre el texto seleccionado en cualquier bloque.
  // execCommand dispara el evento "input" del contenteditable, y RichText
  // actualiza el modelo como si se hubiera escrito.
  format(cmd: 'bold' | 'italic' | 'unlink') {
    document.execCommand(cmd);
  }

  link() {
    const url = prompt('URL del enlace (https://...)');
    if (!url) return;
    if (/^(https?:|mailto:)/.test(url)) document.execCommand('createLink', false, url);
    else alert('El enlace debe empezar por http://, https:// o mailto:');
  }

  protected val = (e: Event) => (e.target as HTMLInputElement).value;
}
