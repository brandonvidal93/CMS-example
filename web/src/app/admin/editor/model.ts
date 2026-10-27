// model.ts — El modelo del EDITOR: el documento convertido en señales
//
// Diferencia clave con la versión anterior (public/editor.js):
//   - Antes, la fuente de verdad era el DOM: al guardar, recorríamos los
//     contenteditable y reconstruíamos el JSON.
//   - Ahora, la fuente de verdad es este modelo. Cada lista de bloques es un
//     signal<BlockVM[]> y cada campo editable es su propia señal. La pantalla
//     se pinta A PARTIR del modelo, y cada cambio en pantalla actualiza el modelo.
//
// ¿Por qué señales? Angular 22 usa OnPush por defecto: un componente solo se
// repinta cuando cambia algo que él lee (una señal, un input). Si mutáramos
// objetos normales (blocks.push(...)), Angular no se enteraría.
//
//   JSON de la API --fromDoc()--> modelo con señales --toDoc()--> JSON para guardar
//
// "VM" = view model: el modelo pensado para la vista.

import { signal, type WritableSignal } from '@angular/core';
import type {
  ArticleDoc, Background, Block, BlockType, Layout, PageDoc, Section, Span,
} from '../../content/types';

const sig = <T>(v: T) => signal(v);

// ─── Bloques ───
export type TextVM = { id: string; type: 'paragraph' | 'quote'; content: WritableSignal<Span[]> };
export type HeadingVM = { id: string; type: 'heading'; level: WritableSignal<2 | 3>; content: WritableSignal<Span[]> };
export type CalloutVM = { id: string; type: 'callout'; tone: WritableSignal<'info' | 'warning'>; content: WritableSignal<Span[]> };
export type ListVM = { id: string; type: 'list'; style: WritableSignal<'bullet' | 'number'>; items: WritableSignal<Span[][]> };
export type ImageVM = { id: string; type: 'image'; url: WritableSignal<string>; alt: WritableSignal<string>; caption: WritableSignal<string> };
export type AccordionVM = { id: string; type: 'accordion'; items: WritableSignal<AccordionItemVM[]> };
export type BlockVM = TextVM | HeadingVM | CalloutVM | ListVM | ImageVM | AccordionVM;

export interface AccordionItemVM {
  key: string;                       // solo para el @for de la plantilla; no se guarda
  title: WritableSignal<string>;
  blocks: WritableSignal<BlockVM[]>;
  collapsed: WritableSignal<boolean>; // estado de la INTERFAZ: no se guarda
}

// ─── Secciones (páginas) ───
export interface ColumnVM { key: string; blocks: WritableSignal<BlockVM[]> }
export interface SectionVM {
  id: string;
  layout: WritableSignal<Layout>;
  background: WritableSignal<Background>;
  columns: WritableSignal<ColumnVM[]>;
}

// ─── Catálogo (lo mismo que acepta la API) ───
export const LABELS: Record<BlockType, string> = {
  paragraph: 'Párrafo', heading: 'Título', list: 'Lista', quote: 'Cita', image: 'Imagen', callout: 'Aviso', accordion: 'Acordeón',
};
export const INNER_TYPES: BlockType[] = ['paragraph', 'heading', 'list', 'quote', 'image', 'callout'];
export const ALL_TYPES: BlockType[] = [...INNER_TYPES, 'accordion'];

export const LAYOUTS: Record<Layout, { cols: number; grid: string; label: string }> = {
  '1':           { cols: 1, grid: '1fr',         label: '1' },
  '1/2+1/2':     { cols: 2, grid: '1fr 1fr',     label: '½ ½' },
  '1/3+2/3':     { cols: 2, grid: '1fr 2fr',     label: '⅓ ⅔' },
  '2/3+1/3':     { cols: 2, grid: '2fr 1fr',     label: '⅔ ⅓' },
  '1/3+1/3+1/3': { cols: 3, grid: '1fr 1fr 1fr', label: '⅓ ⅓ ⅓' },
};
export const LAYOUT_KEYS = Object.keys(LAYOUTS) as Layout[];
export const BACKGROUNDS: [Background, string][] = [['none', 'Sin fondo'], ['light', 'Claro'], ['accent', 'Color']];

export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Crear vacíos ───
export function emptyBlock(type: BlockType): BlockVM {
  const id = newId();
  switch (type) {
    case 'paragraph':
    case 'quote': return { id, type, content: sig([]) };
    case 'heading': return { id, type, level: sig(2), content: sig([]) };
    case 'callout': return { id, type, tone: sig('info'), content: sig([]) };
    case 'list': return { id, type, style: sig('bullet'), items: sig([[]]) };
    case 'image': return { id, type, url: sig(''), alt: sig(''), caption: sig('') };
    case 'accordion': return { id, type, items: sig([emptyAccordionItem()]) };
  }
}

export const emptyAccordionItem = (): AccordionItemVM =>
  ({ key: newId(), title: sig(''), blocks: sig([emptyBlock('paragraph')]), collapsed: sig(false) });

export const emptyColumn = (blocks: BlockVM[] = []): ColumnVM => ({ key: newId(), blocks: sig(blocks) });

export function emptySection(layout: Layout): SectionVM {
  const cols = Array.from({ length: LAYOUTS[layout].cols }, () => emptyColumn());
  return { id: newId(), layout: sig(layout), background: sig('none'), columns: sig(cols) };
}

// ─── JSON -> modelo ───
export function blockFromDoc(b: Block): BlockVM {
  switch (b.type) {
    case 'paragraph':
    case 'quote': return { id: b.id, type: b.type, content: sig(b.content) };
    case 'heading': return { id: b.id, type: 'heading', level: sig(b.level), content: sig(b.content) };
    case 'callout': return { id: b.id, type: 'callout', tone: sig(b.tone), content: sig(b.content) };
    case 'list': return { id: b.id, type: 'list', style: sig(b.style), items: sig(b.items) };
    case 'image': return { id: b.id, type: 'image', url: sig(b.url), alt: sig(b.alt), caption: sig(b.caption) };
    case 'accordion': return {
      id: b.id, type: 'accordion',
      items: sig(b.items.map(it => ({ key: newId(), title: sig(it.title), blocks: sig(it.blocks.map(blockFromDoc)), collapsed: sig(false) }))),
    };
  }
}

export const sectionFromDoc = (s: Section): SectionVM => ({
  id: s.id,
  layout: sig(s.layout),
  background: sig(s.background),
  columns: sig(s.columns.map(c => emptyColumn(c.blocks.map(blockFromDoc)))),
});

// ─── Modelo -> JSON ───
// Al LEER las señales dentro de un computed(), Angular registra la dependencia:
// cualquier cambio en cualquier bloque recalcula el JSON automáticamente.
export function blockToDoc(b: BlockVM): Block {
  switch (b.type) {
    case 'paragraph':
    case 'quote': return { id: b.id, type: b.type, content: b.content() };
    case 'heading': return { id: b.id, type: 'heading', level: b.level(), content: b.content() };
    case 'callout': return { id: b.id, type: 'callout', tone: b.tone(), content: b.content() };
    case 'list': return { id: b.id, type: 'list', style: b.style(), items: b.items() };
    case 'image': return { id: b.id, type: 'image', url: b.url().trim(), alt: b.alt().trim(), caption: b.caption().trim() };
    case 'accordion': return {
      id: b.id, type: 'accordion',
      items: b.items().map(it => ({ title: it.title().trim(), blocks: it.blocks().map(blockToDoc) })),
    };
  }
}

export const articleToDoc = (blocks: BlockVM[]): ArticleDoc => ({ version: 1, blocks: blocks.map(blockToDoc) });

export const pageToDoc = (sections: SectionVM[]): PageDoc => ({
  version: 1,
  sections: sections.map(s => ({
    id: s.id,
    layout: s.layout(),
    background: s.background(),
    columns: s.columns().map(c => ({ blocks: c.blocks().map(blockToDoc) })),
  })),
});

// ─── Utilidades para listas inmutables ───
// Con señales no se hace list.push(x): se crea una lista NUEVA con set/update.
// Así la señal "sabe" que cambió.
export const insertAt = <T>(arr: T[], i: number, item: T) => [...arr.slice(0, i), item, ...arr.slice(i)];
export const removeAt = <T>(arr: T[], i: number) => arr.filter((_, j) => j !== i);
// Mover de la posición "from" a la posición "to" (lo que necesita el arrastrar y soltar)
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export const isBlockVM = (x: unknown): x is BlockVM =>
  !!x && typeof x === 'object' && 'type' in x && 'id' in x;

export function move<T>(arr: T[], i: number, delta: -1 | 1): T[] {
  const j = i + delta;
  if (j < 0 || j >= arr.length) return arr;
  const copy = [...arr];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}
