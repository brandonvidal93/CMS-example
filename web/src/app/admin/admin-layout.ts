import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink],
  host: { class: 'block min-h-screen bg-slate-100 font-sans text-slate-900' },
  template: `
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex items-center justify-between px-4 py-3" [class]="width()">
        <a routerLink="/admin" class="font-bold">Panel</a>
        <a href="/" target="_blank" class="text-sm text-sky-700 hover:underline">Ver sitio público ↗</a>
      </div>
    </header>
    <main class="mx-auto px-4 py-6" [class]="width()">
      <router-outlet />
    </main>
  `,
})
export class AdminLayout {
  private router = inject(Router);
  private url = toSignal(this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.router.url)), { initialValue: this.router.url });
  // El editor de páginas necesita más ancho para las columnas
  protected width = computed(() => (this.url().startsWith('/admin/pages/') ? 'max-w-7xl' : 'max-w-4xl'));

  constructor() {
    inject(Title).setTitle('Panel · Mi Blog');
  }
}
