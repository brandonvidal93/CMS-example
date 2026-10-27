// article-page.ts — Un artículo: /blog/:slug
import { Component, effect, inject, input } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import type { ContentItem, Envelope } from '../core/api';
import type { ArticleDoc } from '../content/types';
import { BlockList } from '../content/block-list';
import { NotFound } from './not-found';
import { Seo } from '../core/seo';
import { sqlDate } from './sql-date';

@Component({
  selector: 'app-article-page',
  imports: [BlockList, DatePipe, NotFound],
  template: `
    @if (article.hasValue()) {
      @let a = article.value().data;
      <main class="mx-auto max-w-5xl px-4">
        <!-- prose: Tailwind Typography da formato a todo el HTML de los bloques -->
        <article class="prose prose-lg prose-brand max-w-2xl">
          <h1>{{ a.title }}</h1>
          <p class="text-sm! text-neutral-500">Publicado el {{ sqlDate(a.published_at) | date: 'longDate' }}</p>
          <app-blocks [blocks]="a.content.blocks" />
        </article>
      </main>
    } @else if (article.error()) {
      <app-not-found />
    }
  `,
})
export class ArticlePage {
  // Llega desde la ruta 'blog/:slug' gracias a withComponentInputBinding()
  readonly slug = input.required<string>();

  // Cuando cambia el slug (navegar de un artículo a otro), se vuelve a pedir solo
  protected article = httpResource<Envelope<ContentItem<ArticleDoc>>>(() => `/api/articles/${this.slug()}`);
  protected sqlDate = sqlDate;

  constructor() {
    const seo = inject(Seo);
    effect(() => {
      if (this.article.hasValue()) {
        const a = this.article.value().data;
        seo.set(a.title, a.excerpt);
      } else if (this.article.error()) {
        seo.notFound();
      }
    });
  }
}
