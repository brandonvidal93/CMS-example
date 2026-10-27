// seo.ts — Título, meta description y código de estado HTTP
//
// Con SSR esto importa de verdad: el HTML que recibe Google ya trae el <title>
// correcto y, si el contenido no existe, la respuesta es un 404 real (no una
// página que dice "no encontrado" con un 200, que confunde a los buscadores).

import { inject, Injectable, RESPONSE_INIT } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

const SITE = 'Mi Blog';

@Injectable({ providedIn: 'root' })
export class Seo {
  private title = inject(Title);
  private meta = inject(Meta);
  // Solo existe en el servidor: permite cambiar el status de la respuesta
  private response = inject(RESPONSE_INIT, { optional: true });

  set(title: string, description?: string | null) {
    this.title.setTitle(title === SITE ? SITE : `${title} · ${SITE}`);
    if (description) this.meta.updateTag({ name: 'description', content: description });
    else this.meta.removeTag('name="description"');
  }

  notFound() {
    this.set('No encontrado');
    if (this.response) this.response.status = 404;
  }
}
