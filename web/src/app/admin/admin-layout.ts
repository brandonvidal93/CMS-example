import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink],
  host: { class: 'admin', '[class.wide]': 'wide()' },
  template: `
    <header class="admin-header">
      <a routerLink="/admin"><b>Panel</b></a>
      <a href="/" target="_blank">Ver sitio público ↗</a>
    </header>
    <router-outlet />
  `,
})
export class AdminLayout {
  private router = inject(Router);
  private url = toSignal(this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.router.url)), { initialValue: this.router.url });
  // El editor de páginas necesita más ancho para las columnas
  protected wide = computed(() => this.url().startsWith('/admin/pages/'));

  constructor() {
    inject(Title).setTitle('Panel · Mi Blog');
  }
}
