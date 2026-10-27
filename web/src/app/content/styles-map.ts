// styles-map.ts — De la INTENCIÓN guardada en la base de datos a clases de Tailwind
//
// Es el "tema" del contenido. El dato dice "1/3+2/3" o "accent"; aquí decidimos
// cómo se ve. Cambiar el diseño de todas las páginas = cambiar este archivo.
//
// IMPORTANTE: las clases van escritas COMPLETAS. Tailwind busca en el código
// los textos que parecen clases y solo genera esas. Algo como `bg-${color}`
// no funcionaría: Tailwind nunca vería "bg-brand-50" escrito en ningún sitio.

import type { Background, Layout } from './types';

// Rejilla de cada layout. En móvil, siempre una columna (grid-cols-1);
// a partir de md (768px) se aplica la rejilla del layout.
export const LAYOUT_CLASS: Record<Layout, string> = {
  '1': 'md:grid-cols-[minmax(0,48rem)]',
  '1/2+1/2': 'md:grid-cols-2',
  '1/3+2/3': 'md:grid-cols-[1fr_2fr]',
  '2/3+1/3': 'md:grid-cols-[2fr_1fr]',
  '1/3+1/3+1/3': 'md:grid-cols-3',
};

// Fondo de la sección. "section-accent" es un marcador: los bloques de dentro
// lo usan para adaptarse (ver el acordeón en block-list.ts: in-[.section-accent]:...)
export const BACKGROUND_CLASS: Record<Background, string> = {
  none: '',
  light: 'bg-brand-50',
  accent: 'section-accent bg-brand-700 text-white',
};

export const CALLOUT_CLASS: Record<'info' | 'warning', string> = {
  info: 'bg-sky-50 text-sky-950',
  warning: 'bg-amber-50 text-amber-950',
};
