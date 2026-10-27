// app.module.ts — La raíz de la aplicación: junta todos los módulos
import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { ContentModule } from './content/content.module.js';

@Module({
  imports: [DatabaseModule, ContentModule],
})
export class AppModule {}
