// inline-html.ts — Convierte una lista de spans en HTML
//
// La usan el sitio público (InlineText) y el editor (RichText), así los dos
// pintan exactamente igual. Todo el texto se escapa: el único HTML que sale de
// aquí son las etiquetas del registro de formatos (marks.ts) y <a>.

import { MARK_ORDER, MARKS } from './marks';
import type { Span } from './types';

export const escapeHtml = (s = '') =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function spansToHtml(spans: Span[]): string {
  return spans.map(s => {
    let html = escapeHtml(s.text).replace(/\n/g, '<br>');
    // De dentro hacia fuera: el último formato del registro queda más cerca del texto
    for (const m of [...MARK_ORDER].reverse()) {
      if (s.marks.includes(m)) html = `<${MARKS[m].tag}>${html}</${MARKS[m].tag}>`;
    }
    if (s.href) html = `<a href="${escapeHtml(s.href)}">${html}</a>`;
    return html;
  }).join('');
}
