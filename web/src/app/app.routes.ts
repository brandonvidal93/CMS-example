// app.routes.ts — Las URLs del sitio
//
// Dos "zonas", cada una con su propio layout:
//   /admin/...   panel (se renderiza en el navegador; ver app.routes.server.ts)
//   todo lo demás: sitio público (se renderiza en el servidor)
//
// El orden importa: Angular usa la PRIMERA ruta que coincide. Por eso ':slug'
// (cualquier palabra = una página) va al final del sitio público.

import { Routes } from '@angular/router';
import { PublicLayout } from './public/public-layout';
import { Home } from './public/home';
import { ArticlePage } from './public/article-page';
import { PagePage } from './public/page-page';
import { NotFound } from './public/not-found';

export const routes: Routes = [
  {
    path: 'admin',
    // loadChildren: el código del panel (el editor, que es lo más pesado) se
    // descarga solo cuando alguien entra a /admin. Los visitantes nunca lo bajan.
    loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES),
  },
  {
    path: '',
    component: PublicLayout,
    children: [
      { path: '', component: Home },
      { path: 'blog/:slug', component: ArticlePage },
      { path: ':slug', component: PagePage },
      { path: '**', component: NotFound },
    ],
  },
];
