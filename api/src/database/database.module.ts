// Un módulo agrupa piezas relacionadas. @Global() hace que DatabaseService
// esté disponible en toda la app sin tener que importar este módulo en cada sitio.

import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
