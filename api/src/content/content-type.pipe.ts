// content-type.pipe.ts — Valida el parámetro :type de la URL
//
// Un "pipe" de Nest transforma o valida un dato ANTES de que llegue al
// controlador. Equivale al app.param('type', ...) de la versión Express:
// si no es "articles" ni "pages", la petición se corta con un 404.

import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';
import type { ContentType } from './blocks/types.js';
import { CONTENT_TYPES } from './content-types.js';

@Injectable()
export class ContentTypePipe implements PipeTransform<string, ContentType> {
  transform(value: string): ContentType {
    if (!(value in CONTENT_TYPES)) throw new NotFoundException(`Tipo de contenido desconocido: ${value}`);
    return value as ContentType;
  }
}
