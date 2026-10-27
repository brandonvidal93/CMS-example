// content-types.ts — Lo que hace distinto a cada tipo de contenido
// (es el objeto TYPES de la versión Express, ahora tipado)

import { validateArticle } from './blocks/schema.js';
import { validatePage } from './blocks/page-schema.js';
import type { ArticleDoc, ContentType, PageDoc } from './blocks/types.js';
import type { ValidationResult } from './blocks/schema.js';

export interface ContentTypeConfig {
  label: string;
  table: 'articles' | 'pages';
  revisions: 'revisions' | 'page_revisions';
  revisionFk: 'article_id' | 'page_id';
  validate: (input: unknown) => ValidationResult<ArticleDoc | PageDoc>;
  reservedSlugs: string[];
}

export const CONTENT_TYPES: Record<ContentType, ContentTypeConfig> = {
  articles: {
    label: 'artículo',
    table: 'articles',
    revisions: 'revisions',
    revisionFk: 'article_id',
    validate: validateArticle,
    reservedSlugs: [],
  },
  pages: {
    label: 'página',
    table: 'pages',
    revisions: 'page_revisions',
    revisionFk: 'page_id',
    validate: validatePage,
    // Las páginas viven en la raíz del sitio Angular (/quienes-somos):
    // no pueden llamarse como las rutas que ya existen
    reservedSlugs: ['admin', 'api', 'blog'],
  },
};
