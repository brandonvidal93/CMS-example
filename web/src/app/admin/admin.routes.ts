// admin.routes.ts — Rutas del panel (se cargan solo al entrar en /admin)
//
// El tipo de contenido va en "data": withComponentInputBinding() lo entrega
// a EditorPage como input "type", igual que el parámetro :id.

import { Routes } from '@angular/router';
import { AdminLayout } from './admin-layout';
import { AdminList } from './admin-list';
import { EditorPage } from './editor/editor-page';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayout,
    children: [
      { path: '', component: AdminList },
      { path: 'articles/new', component: EditorPage, data: { type: 'articles' } },
      { path: 'articles/:id', component: EditorPage, data: { type: 'articles' } },
      { path: 'pages/new', component: EditorPage, data: { type: 'pages' } },
      { path: 'pages/:id', component: EditorPage, data: { type: 'pages' } },
      { path: '**', redirectTo: '' },
    ],
  },
];
