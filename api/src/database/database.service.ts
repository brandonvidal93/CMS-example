// database.service.ts — La conexión a SQLite como un SERVICIO de Nest
//
// En la versión Express, db.js exportaba la conexión y cada archivo la importaba.
// En Nest, la conexión es un "provider": Nest la crea UNA vez y se la entrega
// (inyecta) a quien la pida en su constructor. Esto se llama inyección de
// dependencias, y es la misma idea que usa Angular con sus servicios.

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  // La ruta se puede cambiar con la variable de entorno DB_PATH (útil para pruebas)
  readonly db: Database.Database = new Database(process.env.DB_PATH ?? 'cms.db');

  constructor() {
    this.db.pragma('journal_mode = WAL'); // lecturas y escrituras simultáneas sin bloquearse
    this.db.pragma('foreign_keys = ON');
    this.createTables();
    this.logger.log(`Base de datos: ${this.db.name}`);
  }

  // Las mismas tablas de la versión Express: una base de datos existente
  // (cms.db) funciona sin cambios.
  private createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        title        TEXT NOT NULL,
        slug         TEXT NOT NULL UNIQUE,
        body         TEXT NOT NULL,              -- {"version":1,"blocks":[...]}
        excerpt      TEXT,
        status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
        published_at TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS revisions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id  INTEGER NOT NULL REFERENCES articles(id),
        title       TEXT NOT NULL,
        body        TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pages (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        title        TEXT NOT NULL,
        slug         TEXT NOT NULL UNIQUE,
        body         TEXT NOT NULL,              -- {"version":1,"sections":[...]}
        excerpt      TEXT,
        status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
        published_at TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS page_revisions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        page_id     INTEGER NOT NULL REFERENCES pages(id),
        title       TEXT NOT NULL,
        body        TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  // Nest llama a esto al apagar la aplicación: cerramos la base ordenadamente
  onModuleDestroy() {
    this.db.close();
  }
}
