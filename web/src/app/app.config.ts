import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { routes } from './app.routes';

// Fechas, números y meses en español (DatePipe: "27 de octubre de 2026")
registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: los parámetros de la ruta (:slug, :type, :id)
    // llegan a los componentes como inputs, sin tener que leer ActivatedRoute
    provideRouter(routes, withComponentInputBinding()),
    // Hidratación: el navegador "adopta" el HTML que generó el servidor en vez de
    // pintarlo otra vez. También reutiliza las respuestas HTTP que el servidor ya
    // pidió (van incrustadas en la página), así no se piden dos veces.
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch()),
    { provide: LOCALE_ID, useValue: 'es' },
  ],
};
