import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Seo } from '../core/seo';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <main class="mx-auto max-w-5xl px-4">
      <h1 class="text-4xl font-bold">404</h1>
      <p class="mt-4">Esta página no existe o no está publicada.
        <a routerLink="/" class="text-brand-700 underline">Volver al inicio</a></p>
    </main>
  `,
})
export class NotFound {
  constructor() {
    inject(Seo).notFound();
  }
}
