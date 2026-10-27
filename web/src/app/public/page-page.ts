// page-page.ts — Una página con secciones: /:slug
import { Component, effect, inject, input } from '@angular/core';
import { httpResource } from '@angular/common/http';
import type { ContentItem, Envelope } from '../core/api';
import type { PageDoc } from '../content/types';
import { SectionsView } from '../content/sections-view';
import { NotFound } from './not-found';
import { Seo } from '../core/seo';

@Component({
  selector: 'app-page-page',
  imports: [SectionsView, NotFound],
  template: `
    @if (page.hasValue()) {
      @let p = page.value().data;
      <main class="page">
        <div class="wrap"><h1 class="page-title">{{ p.title }}</h1></div>
        <app-sections [sections]="p.content.sections" />
      </main>
    } @else if (page.error()) {
      <app-not-found />
    }
  `,
})
export class PagePage {
  readonly slug = input.required<string>();
  protected page = httpResource<Envelope<ContentItem<PageDoc>>>(() => `/api/pages/${this.slug()}`);

  constructor() {
    const seo = inject(Seo);
    effect(() => {
      if (this.page.hasValue()) {
        const p = this.page.value().data;
        seo.set(p.title, p.excerpt);
      } else if (this.page.error()) {
        seo.notFound();
      }
    });
  }
}
