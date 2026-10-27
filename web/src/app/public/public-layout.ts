// public-layout.ts — Cabecera + contenido + pie del sitio público
// (el publicLayout() de views.js, ahora como componente)

import { Component } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink, RouterOutlet } from '@angular/router';
import type { Envelope, NavItem } from '../core/api';

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, RouterLink],
  template: `
    <header class="site-header">
      <div class="wrap">
        <a routerLink="/" class="brand">Mi Blog</a>
        @if (nav.hasValue()) {
          <nav>
            @for (p of nav.value().data; track p.slug) {
              <a [routerLink]="['/', p.slug]">{{ p.title }}</a>
            }
          </nav>
        }
      </div>
    </header>
    <router-outlet />
    <footer class="site-footer"><div class="wrap">Hecho con Mini CMS · Angular + NestJS</div></footer>
  `,
})
export class PublicLayout {
  // Las páginas publicadas para el menú. Como es una señal, la plantilla se
  // actualiza sola cuando llegan los datos.
  protected nav = httpResource<Envelope<NavItem[]>>(() => '/api/nav');
}
