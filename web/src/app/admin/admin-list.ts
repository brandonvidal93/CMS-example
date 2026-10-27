// admin-list.ts — Portada del panel: páginas y artículos (borradores incluidos)
import { Component } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { AdminListItem, Envelope } from '../core/api';

@Component({
  selector: 'app-admin-list',
  imports: [RouterLink, NgTemplateOutlet],
  template: `
    <h1>Páginas</h1>
    <p><a routerLink="/admin/pages/new">+ Nueva página</a> · <a href="/api/pages" target="_blank">API</a><br />
      <small>Secciones con columnas. Para inicio, "quiénes somos", landings... Aparecen en el menú.</small></p>
    @if (pages.hasValue()) { <ng-container [ngTemplateOutlet]="table" [ngTemplateOutletContext]="{ $implicit: pages.value().data, type: 'pages' }" /> }

    <h1>Artículos</h1>
    <p><a routerLink="/admin/articles/new">+ Nuevo artículo</a> · <a href="/api/articles" target="_blank">API</a><br />
      <small>Una columna de bloques. Para el blog.</small></p>
    @if (articles.hasValue()) { <ng-container [ngTemplateOutlet]="table" [ngTemplateOutletContext]="{ $implicit: articles.value().data, type: 'articles' }" /> }

    @if (pages.error() || articles.error()) { <p class="errors">No se pudo conectar con la API. ¿Está arrancada?</p> }

    <ng-template #table let-rows let-type="type">
      @if (rows.length === 0) {
        <p>Todavía no hay nada aquí.</p>
      } @else {
        <table>
          <tr><th>Título</th><th>Estado</th><th>Actualizado</th><th></th></tr>
          @for (r of asRows(rows); track r.id) {
            <tr>
              <td><a [routerLink]="['/admin', type, r.id]">{{ r.title }}</a></td>
              <td><span class="badge" [class]="r.status">{{ r.status === 'published' ? 'Publicado' : 'Borrador' }}</span></td>
              <td>{{ r.updated_at }}</td>
              <td>@if (r.status === 'published') { <a [href]="type === 'pages' ? '/' + r.slug : '/blog/' + r.slug" target="_blank">ver</a> }</td>
            </tr>
          }
        </table>
      }
    </ng-template>
  `,
})
export class AdminList {
  protected pages = httpResource<Envelope<AdminListItem[]>>(() => '/api/admin/pages');
  protected articles = httpResource<Envelope<AdminListItem[]>>(() => '/api/admin/articles');
  protected asRows = (r: unknown) => r as AdminListItem[];
}
