// Pruebas del contrato de contenido. Ejecuta:  npm test
import { validateArticle } from './schema.js';
import { validatePage } from './page-schema.js';
import { makeExcerpt, toMarkdown } from './text.js';

const p = (text: string) => ({ type: 'paragraph', content: [{ text, marks: [] }] });

describe('validateArticle', () => {
  it('limpia campos desconocidos, une spans y asigna ids', () => {
    const r = validateArticle({
      blocks: [{
        type: 'paragraph', onclick: 'robar()',
        content: [{ text: 'Ho', marks: [] }, { text: 'la', marks: [] }, { text: '', marks: ['bold'] }],
      }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.blocks[0]).toEqual({ id: expect.stringMatching(/^[a-f0-9]{8}$/), type: 'paragraph', content: [{ text: 'Hola', marks: [] }] });
  });

  it('rechaza tipos, formatos y enlaces no permitidos', () => {
    const r = validateArticle({
      blocks: [
        { type: 'script', content: [] },
        { type: 'paragraph', content: [{ text: 'x', marks: ['underline'] }] },
        { type: 'paragraph', content: [{ text: 'x', marks: [], href: 'javascript:alert(1)' }] },
        { type: 'image', url: 'javascript:alert(1)' },
      ],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual([
      'Bloque 1 (script): tipo de bloque desconocido',
      'Bloque 2 (paragraph): span 0: formato "underline" no permitido',
      'Bloque 3 (paragraph): span 0: enlace no válido',
      'Bloque 4 (image): url debe empezar por http:// o https://',
    ]);
  });

  it('no permite un acordeón dentro de otro', () => {
    const r = validateArticle({ blocks: [{ type: 'accordion', items: [{ title: 'A', blocks: [{ type: 'accordion', items: [] }] }] }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain('no se puede poner dentro de otro contenedor');
  });
});

describe('validatePage', () => {
  it('acepta secciones con columnas y un acordeón dentro de una columna', () => {
    const r = validatePage({
      sections: [{
        layout: '1/3+2/3', background: 'light',
        columns: [{ blocks: [p('izq')] }, { blocks: [{ type: 'accordion', items: [{ title: 'Q', blocks: [p('A')] }] }] }],
      }],
    });
    expect(r.ok).toBe(true);
  });

  it('comprueba que el número de columnas coincida con el layout', () => {
    const r = validatePage({ sections: [{ layout: '1/2+1/2', columns: [{ blocks: [p('x')] }] }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual(['Sección 1: el layout "1/2+1/2" necesita 2 columna(s) y llegaron 1']);
  });

  it('no acepta colores literales', () => {
    const r = validatePage({ sections: [{ layout: '1', background: '#ff0000', columns: [{ blocks: [p('x')] }] }] });
    expect(r.ok).toBe(false);
  });
});

describe('texto y markdown', () => {
  it('aplana una página en orden de lectura', () => {
    const r = validatePage({ sections: [{ layout: '1/2+1/2', columns: [{ blocks: [p('Uno')] }, { blocks: [p('Dos')] }] }] });
    if (!r.ok) throw new Error('debería ser válida');
    expect(makeExcerpt(r.doc)).toBe('Uno Dos');
    expect(toMarkdown('T', r.doc)).toBe('# T\n\nUno\n\nDos\n');
  });
});

describe('formato tachado (strike)', () => {
  it('se acepta y se exporta a Markdown como ~~texto~~', () => {
    const r = validateArticle({ blocks: [{ type: 'paragraph', content: [{ text: 'precio viejo', marks: ['strike', 'bold'] }] }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.blocks[0]).toMatchObject({ content: [{ text: 'precio viejo', marks: ['bold', 'strike'] }] });
    expect(toMarkdown('T', r.doc)).toBe('# T\n\n**~~precio viejo~~**\n');
  });

  it('escapa ~ en el texto normal para que no se convierta en tachado', () => {
    const r = validateArticle({ blocks: [{ type: 'paragraph', content: [{ text: 'unas ~~10 personas', marks: [] }] }] });
    if (!r.ok) throw new Error('debería ser válido');
    expect(toMarkdown('T', r.doc)).toBe('# T\n\nunas \\~\\~10 personas\n');
  });
});

describe('resaltado y código en línea', () => {
  it('se aceptan y se exportan a Markdown', () => {
    const r = validateArticle({ blocks: [{ type: 'paragraph', content: [
      { text: 'Ejecuta ', marks: [] },
      { text: 'npm install', marks: ['code'] },
      { text: ' y ', marks: [] },
      { text: 'no lo olvides', marks: ['highlight'] },
    ] }] });
    if (!r.ok) throw new Error(r.errors.join());
    expect(toMarkdown('T', r.doc)).toBe('# T\n\nEjecuta `npm install` y ==no lo olvides==\n');
  });

  it('el código no se escapa y admite comillas invertidas', () => {
    const r = validateArticle({ blocks: [{ type: 'paragraph', content: [{ text: 'a*b `c`', marks: ['code'] }] }] });
    if (!r.ok) throw new Error(r.errors.join());
    expect(toMarkdown('T', r.doc)).toBe('# T\n\n`` a*b `c` ``\n');
  });
});
