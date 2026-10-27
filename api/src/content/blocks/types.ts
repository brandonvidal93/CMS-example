// types.ts — La forma del contenido, escrita como TIPOS de TypeScript
//
// En JavaScript la forma del JSON vivía solo en comentarios. Aquí el compilador
// la conoce: si escribes block.level en un párrafo, te avisa antes de ejecutar.
//
// Este archivo está COPIADO tal cual en web/src/app/content/types.ts.
// Si cambias uno, cambia el otro (con npm workspaces podrían compartir un paquete).

export type Mark = 'bold' | 'italic' | 'strike' | 'highlight' | 'code';

export interface Span {
  text: string;
  marks: Mark[];
  href?: string;
}

// Una "unión discriminada": el campo `type` decide qué otros campos existen.
// TypeScript lo entiende: dentro de `if (b.type === 'heading')` sabe que b.level existe.
export type Block =
  | { id: string; type: 'paragraph'; content: Span[] }
  | { id: string; type: 'heading'; level: 2 | 3; content: Span[] }
  | { id: string; type: 'quote'; content: Span[] }
  | { id: string; type: 'list'; style: 'bullet' | 'number'; items: Span[][] }
  | { id: string; type: 'image'; url: string; alt: string; caption: string }
  | { id: string; type: 'callout'; tone: 'info' | 'warning'; content: Span[] }
  | { id: string; type: 'accordion'; items: AccordionItem[] };

export type BlockType = Block['type'];

export interface AccordionItem {
  title: string;
  blocks: Block[];
}

// ── Artículos: una sola lista de bloques ──
export interface ArticleDoc {
  version: 1;
  blocks: Block[];
}

// ── Páginas: secciones con columnas ──
export type Layout = '1' | '1/2+1/2' | '1/3+2/3' | '2/3+1/3' | '1/3+1/3+1/3';
export type Background = 'none' | 'light' | 'accent';

export interface Column {
  blocks: Block[];
}

export interface Section {
  id: string;
  layout: Layout;
  background: Background;
  columns: Column[];
}

export interface PageDoc {
  version: 1;
  sections: Section[];
}

export type ContentType = 'articles' | 'pages';
export type Status = 'draft' | 'published';
