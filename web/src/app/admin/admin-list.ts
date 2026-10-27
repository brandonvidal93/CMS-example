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
    @if (pages.error() || articles.error()) {
      <p class="mb-4 rounded-md bg-red-50 px-3 py-2 text-red-800">No se pudo conectar con la API. ¿Está arrancada?</p>
    }

    <section class="mb-10">
      <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 class="text-2xl font-bold">Páginas</h1>
          <p class="text-sm text-slate-500">Secciones con columnas. Para inicio, "quiénes somos", landings… Aparecen en el menú.</p>
        </div>
        <a routerLink="/admin/pages/new" class="btn-primary">+ Nueva página</a>
      </div>
      @if (pages.hasValue()) {
        <ng-container [ngTemplateOutlet]="table" [ngTemplateOutletContext]="{ $implicit: pages.value().data, type: 'pages' }" />
      }
    </section>

    <section>
      <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 class="text-2xl font-bold">Artículos</h1>
          <p class="text-sm text-slate-500">Una columna de bloques. Para el blog.</p>
        </div>
        <a routerLink="/admin/articles/new" class="btn-primary">+ Nuevo artículo</a>
      </div>
      @if (articles.hasValue()) {
        <ng-container [ngTemplateOutlet]="table" [ngTemplateOutletContext]="{ $implicit: articles.value().data, type: 'articles' }" />
      }
    </section>

    <ng-template #table let-rows let-type="type">
      @if (rows.length === 0) {
        <p class="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Todavía no hay nada aquí.</p>
      } @else {
        <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
              <tr><th class="px-4 py-2">Título</th><th class="px-4 py-2">Estado</th><th class="hidden px-4 py-2 sm:table-cell">Actualizado</th><th class="px-4 py-2"></th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (r of asRows(rows); track r.id) {
                <tr class="hover:bg-slate-50">
                  <td class="px-4 py-2"><a [routerLink]="['/admin', type, r.id]" class="font-medium text-sky-700 hover:underline">{{ r.title }}</a></td>
                  <td class="px-4 py-2">
                    <span class="rounded-full px-2 py-0.5 text-xs"
                          [class]="r.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'">
                      {{ r.status === 'published' ? 'Publicado' : 'Borrador' }}</span>
                  </td>
                  <td class="hidden px-4 py-2 text-slate-500 sm:table-cell">{{ r.updated_at }}</td>
                  <td class="px-4 py-2 text-right">
                    @if (r.status === 'published') {
                      <a [href]="type === 'pages' ? '/' + r.slug : '/blog/' + r.slug" target="_blank" class="text-sky-700 hover:underline">ver ↗</a>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </ng-template>
  `,
})
export class AdminList {
  protected pages = httpResource<Envelope<AdminListItem[]>>(() => '/api/admin/pages');
  protected articles = httpResource<Envelope<AdminListItem[]>>(() => '/api/admin/articles');
  protected asRows = (r: unknown) => r as AdminListItem[];
}
