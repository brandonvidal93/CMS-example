// admin.controller.ts — Las rutas del PANEL (lectura y escritura)
//
// Los decoradores (@Get, @Post, @Param...) describen la ruta; Nest se encarga
// de leer la petición y de convertir lo que devolvemos en JSON.
//
//   GET  /api/admin/articles        lista (borradores incluidos)
//   GET  /api/admin/articles/5      uno, para editarlo
//   POST /api/admin/articles        crear
//   PUT  /api/admin/articles/5      actualizar
//   (lo mismo con /pages)
//
// Igual que antes, NO hay inicio de sesión: cualquiera puede escribir aquí.

import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ContentService, type SaveInput } from './content.service.js';
import { ContentTypePipe } from './content-type.pipe.js';
import type { ContentType } from './blocks/types.js';

@Controller('admin/:type')
export class AdminController {
  constructor(private readonly content: ContentService) {}

  @Get()
  list(@Param('type', ContentTypePipe) type: ContentType) {
    return { data: this.content.list(type) };
  }

  // ParseIntPipe convierte "5" en 5, y responde 400 si no es un número
  @Get(':id')
  get(@Param('type', ContentTypePipe) type: ContentType, @Param('id', ParseIntPipe) id: number) {
    return { data: this.content.getById(type, id) };
  }

  @Post()
  create(@Param('type', ContentTypePipe) type: ContentType, @Body() body: SaveInput) {
    return { data: this.content.save(type, null, body) };
  }

  @Put(':id')
  update(@Param('type', ContentTypePipe) type: ContentType, @Param('id', ParseIntPipe) id: number, @Body() body: SaveInput) {
    return { data: this.content.save(type, id, body) };
  }
}
