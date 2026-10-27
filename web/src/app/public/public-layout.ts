// public-layout.ts — Cabecera + contenido + pie del sitio público
import { Component } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import type { Envelope, NavItem } from '../core/api';

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  host: { class: 'block min-h-screen font-serif text-ink' },
  template: `
    <header class="py-6">
      <div class="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-6 gap-y-2 px-4">
        <a routerLink="/" class="font-bold text-ink-soft no-underline">Mi Blog</a>
        @if (nav.hasValue()) {
          <nav class="flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
            @for (p of nav.value().data; track p.slug) {
              <a [routerLink]="['/', p.slug]" routerLinkActive="underline underline-offset-4"
                 class="text-ink-soft no-underline hover:text-brand-700">{{ p.title }}</a>
            }
          </nav>
        }
      </div>
    </header>
    <router-outlet />
    <footer class="mt-12 py-6 text-[13px] text-neutral-500">
      <div class="mx-auto max-w-5xl px-4">Hecho con Mini CMS · Angular + NestJS</div>
    </footer>
  `,
})
export class PublicLayout {
  protected nav = httpResource<Envelope<NavItem[]>>(() => '/api/nav');
}
