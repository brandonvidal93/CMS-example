// content.service.ts — La lógica de negocio: leer, validar y guardar contenido
//
// En Nest se separa:
//   - el CONTROLADOR: recibe la petición HTTP y devuelve la respuesta
//   - el SERVICIO:    hace el trabajo (no sabe nada de HTTP)
// Así el servicio se puede reutilizar (desde un script, una tarea programada,
// una prueba) sin pasar por la web.

import { Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CONTENT_TYPES } from './content-types.js';
import { makeExcerpt } from './blocks/text.js';
import type { ArticleDoc, ContentType, PageDoc, Status } from './blocks/types.js';

// Una fila tal como está en la BD (body es TEXTO)
interface Row {
  id: number;
  title: string;
  slug: string;
  body: string;
  excerpt: string | null;
  status: Status;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

// Lo que devolvemos: igual, pero con el documento ya convertido a objeto
export type ContentItem = Omit<Row, 'body'> & { type: ContentType; content: ArticleDoc | PageDoc };

export interface SaveInput {
  title?: unknown;
  status?: unknown;
  content?: unknown;
}

export function slugify(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sin-titulo';
}

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  // Nest ve que el constructor pide un DatabaseService y se lo entrega (inyección de dependencias)
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  private toItem(type: ContentType, row: Row): ContentItem {
    const { body, ...rest } = row;
    let content: ArticleDoc | PageDoc;
    try {
      content = JSON.parse(body);
    } catch {
      // Contenido en el formato HTML antiguo: hay que migrarlo con la versión Express
      throw new UnprocessableEntityException('Este contenido está en HTML (formato antiguo) y no se puede abrir');
    }
    return { ...rest, type, content };
  }

  // ── Panel ──

  list(type: ContentType) {
    const { table } = CONTENT_TYPES[type];
    return this.db
      .prepare(`SELECT id, title, slug, status, updated_at, published_at FROM ${table} ORDER BY updated_at DESC`)
      .all();
  }

  getById(type: ContentType, id: number): ContentItem {
    const row = this.db.prepare(`SELECT * FROM ${CONTENT_TYPES[type].table} WHERE id = ?`).get(id) as Row | undefined;
    if (!row) throw new NotFoundException();
    return this.toItem(type, row);
  }

  // GUARDAR — los mismos 6 pasos de siempre. id = null significa "crear".
  save(type: ContentType, id: number | null, input: SaveInput): ContentItem {
    const cfg = CONTENT_TYPES[type];
    if (id !== null && !this.db.prepare(`SELECT id FROM ${cfg.table} WHERE id = ?`).get(id)) throw new NotFoundException();

    // 1-2. Validar título, estado y documento
    const errors: string[] = [];
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title) errors.push('El título es obligatorio');
    if (title.length > 200) errors.push('El título es demasiado largo');

    const status: Status = input.status === 'published' ? 'published' : 'draft';

    const result = cfg.validate(input.content);
    if (!result.ok) errors.push(...result.errors);

    // 422 con la lista de errores: Angular los mostrará encima del editor
    if (errors.length || !result.ok) throw new UnprocessableEntityException({ message: 'Contenido no válido', errors });
    const doc = result.doc;

    // 3. Campos derivados
    const slug = this.uniqueSlug(type, slugify(title), id);
    const excerpt = makeExcerpt(doc);
    const body = JSON.stringify(doc);

    // 4. Guardar en una transacción
    const save = this.db.transaction((): number => {
      if (id !== null) {
        this.db.prepare(`INSERT INTO ${cfg.revisions} (${cfg.revisionFk}, title, body)
                         SELECT id, title, body FROM ${cfg.table} WHERE id = ?`).run(id);
        this.db.prepare(`UPDATE ${cfg.table}
                            SET title = ?, slug = ?, body = ?, excerpt = ?, status = ?,
                                published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, datetime('now')) ELSE published_at END,
                                updated_at = datetime('now')
                          WHERE id = ?`)
          .run(title, slug, body, excerpt, status, status, id);
        return id;
      }
      const info = this.db.prepare(`INSERT INTO ${cfg.table} (title, slug, body, excerpt, status, published_at)
                                    VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN datetime('now') END)`)
        .run(title, slug, body, excerpt, status, status);
      return Number(info.lastInsertRowid);
    });
    const savedId = save();

    // 5. Efectos secundarios
    this.logger.log(`${cfg.label} ${savedId} -> ${status} -> ${slug}`);

    // 6. Devolvemos lo guardado: Angular actualiza el editor con la versión limpia
    return this.getById(type, savedId);
  }

  private uniqueSlug(type: ContentType, base: string, currentId: number | null): string {
    const cfg = CONTENT_TYPES[type];
    const exists = this.db.prepare(`SELECT id FROM ${cfg.table} WHERE slug = ? AND id != ?`);
    let slug = base;
    let n = 2;
    while (cfg.reservedSlugs.includes(slug) || exists.get(slug, currentId ?? -1)) slug = `${base}-${n++}`;
    return slug;
  }

  // ── Público: solo lo publicado ──

  listPublished(type: ContentType) {
    return this.db.prepare(`SELECT title, slug, excerpt, published_at FROM ${CONTENT_TYPES[type].table}
                            WHERE status = 'published' ORDER BY published_at DESC`).all();
  }

  getPublished(type: ContentType, slug: string): ContentItem {
    const row = this.db.prepare(`SELECT * FROM ${CONTENT_TYPES[type].table} WHERE slug = ? AND status = 'published'`)
      .get(slug) as Row | undefined;
    if (!row) throw new NotFoundException();
    return this.toItem(type, row);
  }

  // Páginas para el menú de la cabecera
  nav() {
    return this.db.prepare(`SELECT title, slug FROM pages WHERE status = 'published' ORDER BY created_at`).all();
  }
}
