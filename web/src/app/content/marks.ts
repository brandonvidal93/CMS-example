// marks.ts — El REGISTRO de formatos de texto (marks)
//
// Un "mark" es un formato que se aplica a un trozo de texto dentro de un bloque:
//   { "text": "importante", "marks": ["bold"] }
//
// Todo lo que el frontend necesita saber de cada formato está aquí, en un solo
// sitio, y lo usan tres piezas:
//   - el sitio público (inline-html.ts) para pintar <strong>, <em>...
//   - el editor (rich-text.ts) para reconocer las etiquetas al leer lo escrito
//   - la barra de herramientas (editor-page.ts), que crea un botón por formato
//
// Es un Record<Mark, ...>: si añades un formato al tipo Mark (types.ts) y no lo
// registras aquí, TypeScript da un error. El compilador te recuerda el paso.

import type { Mark } from './types';

export interface MarkDef {
  tag: string;          // etiqueta HTML con la que se pinta
  reads: string[];      // etiquetas que el editor reconoce como este formato
  label: string;        // texto del botón en la barra
  title: string;        // descripción del botón (tooltip y accesibilidad)
  command: string;      // orden de document.execCommand que lo aplica en el editor
  buttonClass?: string; // aspecto del botón (clases de Tailwind)
}

export const MARKS: Record<Mark, MarkDef> = {
  bold: { tag: 'strong', reads: ['b', 'strong'], label: 'N', title: 'Negrita', command: 'bold', buttonClass: 'font-bold' },
  italic: { tag: 'em', reads: ['i', 'em'], label: 'K', title: 'Cursiva', command: 'italic', buttonClass: 'italic' },
};

// El orden del registro es el orden de anidado: el primero queda por fuera.
// <strong><em>texto</em></strong>
export const MARK_ORDER = Object.keys(MARKS) as Mark[];

// Etiqueta HTML -> formato  ("b" -> "bold", "strong" -> "bold", "i" -> "italic"...)
export const MARK_BY_TAG: Record<string, Mark> = Object.fromEntries(
  MARK_ORDER.flatMap(m => MARKS[m].reads.map(tag => [tag, m])),
);
