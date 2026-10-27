// public.controller.ts — Las rutas PÚBLICAS (solo lectura, solo lo publicado)
//
//   GET /api/nav                          páginas para el menú
//   GET /api/articles                     lista de artículos publicados
//   GET /api/articles/:slug               uno, con sus bloques
//   GET /api/articles/:slug/markdown      el mismo contenido en Markdown
//   (lo mismo con /pages)
//
// Es lo que consume el sitio Angular, y lo que consumiría una app móvil.

import { Controller, Get, Header, Param } from '@nestjs/common';
import { ContentService } from './content.service.js';
import { ContentTypePipe } from './content-type.pipe.js';
import { toMarkdown } from './blocks/text.js';
import type { ContentType } from './blocks/types.js';

@Controller()
export class PublicController {
  constructor(private readonly content: ContentService) {}

  // Va antes que ':type' en el archivo: si no, "nav" se tomaría como un tipo de contenido
  @Get('nav')
  nav() {
    return { data: this.content.nav() };
  }

  @Get(':type')
  list(@Param('type', ContentTypePipe) type: ContentType) {
    return { data: this.content.listPublished(type) };
  }

  @Get(':type/:slug')
  get(@Param('type', ContentTypePipe) type: ContentType, @Param('slug') slug: string) {
    // Al público no le enviamos el id interno ni las fechas de creación
    const { id, created_at, ...item } = this.content.getPublished(type, slug);
    return { data: item };
  }

  @Get(':type/:slug/markdown')
  @Header('Content-Type', 'text/markdown; charset=utf-8')
  markdown(@Param('type', ContentTypePipe) type: ContentType, @Param('slug') slug: string) {
    const item = this.content.getPublished(type, slug);
    return toMarkdown(item.title, item.content);
  }
}
