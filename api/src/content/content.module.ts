import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { PublicController } from './public.controller.js';
import { ContentService } from './content.service.js';

// El orden de los controladores importa: las rutas de AdminController
// (/admin/...) deben registrarse antes que las de PublicController (/:type/...),
// o "admin" se interpretaría como un tipo de contenido.
@Module({
  controllers: [AdminController, PublicController],
  providers: [ContentService],
})
export class ContentModule {}
