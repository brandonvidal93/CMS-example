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
    <main class="wrap">
      <div class="narrow">
      <h1>Últimos artículos</h1>
      @if (articles.hasValue()) {
        @for (a of articles.value().data; track a.slug) {
          <section class="teaser">
            <h2><a [routerLink]="['/blog', a.slug]">{{ a.title }}</a></h2>
            <p class="meta">{{ sqlDate(a.published_at) | date: 'longDate' }}</p>
            <p>{{ a.excerpt }}</p>
          </section>
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
