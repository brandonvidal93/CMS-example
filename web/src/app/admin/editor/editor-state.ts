// editor-state.ts — Estado compartido por todos los componentes de UN editor
//
// Se provee en EditorPage (providers: [EditorState]), así cada editor abierto
// tiene el suyo y todos sus hijos reciben la misma instancia al inyectarlo.

import { ApplicationRef, inject, Injectable, signal } from '@angular/core';

@Injectable()
export class EditorState {
  private appRef = inject(ApplicationRef);

  // "Que el bloque con este id tome el foco". El RichText de ese bloque lo ve
  // (es una señal) y se enfoca.
  readonly focusRequest = signal<string | null>(null);

  // Normalmente Angular repinta "un poco después" de un cambio (agrupa varios
  // cambios en un solo repintado). Pero al pulsar Enter, el bloque nuevo tiene que
  // existir YA: si alguien escribe rápido, las teclas que lleguen antes caerían
  // en el bloque anterior. tick() fuerza el repintado en este mismo instante,
  // y así el foco se mueve antes de la siguiente tecla.
  focus(id: string) {
    this.focusRequest.set(id);
    this.appRef.tick();
  }

  // Lo mismo para cualquier elemento por su id de HTML (el título de un elemento del acordeón)
  focusElement(domId: string) {
    this.appRef.tick();
    document.getElementById(domId)?.focus();
  }
}
