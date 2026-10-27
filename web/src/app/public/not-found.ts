import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Seo } from '../core/seo';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <main class="wrap">
      <h1>404</h1>
      <p>Esta página no existe o no está publicada. <a routerLink="/">Volver al inicio</a></p>
    </main>
  `,
})
export class NotFound {
  constructor() {
    inject(Seo).notFound();
  }
}
