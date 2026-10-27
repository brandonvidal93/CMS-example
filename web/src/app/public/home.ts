// home.ts — Portada: lista de artículos publicados
import { Component, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { Envelope, ListItem } from '../core/api';
import { Seo } from '../core/seo';
import { sqlDate } from './sql-date';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DatePipe],
  template: `
    <main class="mx-auto max-w-5xl px-4">
      <div class="max-w-2xl">
        <h1 class="mb-8 text-4xl font-bold">Últimos artículos</h1>
        @if (articles.hasValue()) {
          @for (a of articles.value().data; track a.slug) {
            <article class="mb-10">
              <h2 class="text-2xl font-bold">
                <a [routerLink]="['/blog', a.slug]" class="hover:text-brand-700">{{ a.title }}</a>
              </h2>
              <p class="mt-1 text-sm text-neutral-500">{{ sqlDate(a.published_at) | date: 'longDate' }}</p>
              <p class="mt-2 leading-relaxed">{{ a.excerpt }}</p>
            </article>
          } @empty {
            <p>Todavía no hay artículos publicados.</p>
          }
        } @else if (articles.error()) {
          <p>No se pudo conectar con la API. ¿Está arrancada?</p>
        }
      </div>
    </main>
  `,
})
export class Home {
  protected articles = httpResource<Envelope<ListItem[]>>(() => '/api/articles');
  protected sqlDate = sqlDate;

  constructor() {
    inject(Seo).set('Mi Blog');
  }
}
