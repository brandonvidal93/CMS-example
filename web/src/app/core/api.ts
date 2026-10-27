// api.ts — Todo lo que habla con la API de Nest pasa por aquí
//
// Las URLs son RELATIVAS (/api/...), tanto en el navegador como en el servidor:
//   - navegador: /api llega a Nest por el proxy (proxy.conf.json con ng serve,
//     server.ts en producción)
//   - servidor (SSR): Angular completa la URL con la dirección de la petición que
//     está renderizando (http://localhost:4000/api/...), que pasa por ese mismo proxy
//
// Que la URL sea idéntica en los dos lados importa: la respuesta que el servidor
// pidió viaja incrustada en el HTML, y el navegador la encuentra por su URL. Si
// fueran distintas, el navegador volvería a pedir todo al hidratar.

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { ArticleDoc, ContentType, PageDoc, Status } from '../content/types';

// ── Formas de las respuestas ──
export interface Envelope<T> { data: T }

export interface ListItem { title: string; slug: string; excerpt: string | null; published_at: string | null }
export interface NavItem { title: string; slug: string }
export interface AdminListItem { id: number; title: string; slug: string; status: Status; updated_at: string; published_at: string | null }

export interface ContentItem<D = ArticleDoc | PageDoc> {
  id?: number;
  type: ContentType;
  title: string;
  slug: string;
  excerpt: string | null;
  status: Status;
  published_at: string | null;
  updated_at: string;
  content: D;
}

export interface SavePayload { title: string; status: Status; content: ArticleDoc | PageDoc }

// Solo para el panel (el público usa httpResource directamente en sus componentes)
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private http = inject(HttpClient);

  list(type: ContentType) {
    return this.http.get<Envelope<AdminListItem[]>>(`/api/admin/${type}`);
  }

  get(type: ContentType, id: number) {
    return this.http.get<Envelope<ContentItem>>(`/api/admin/${type}/${id}`);
  }

  save(type: ContentType, id: number | null, payload: SavePayload) {
    return id === null
      ? this.http.post<Envelope<ContentItem>>(`/api/admin/${type}`, payload)
      : this.http.put<Envelope<ContentItem>>(`/api/admin/${type}/${id}`, payload);
  }
}
