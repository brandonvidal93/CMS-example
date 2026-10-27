# Mini CMS por bloques

Un CMS pequeño para aprender cómo funcionan por dentro: el contenido se guarda como
**bloques JSON** en SQLite, una **API en NestJS** lo valida y lo sirve, y una app
**Angular con SSR** lo muestra al público y ofrece el panel de edición.
Estilos con **Tailwind CSS 4** (+ `@tailwindcss/typography`) y arrastrar y soltar con **Angular CDK**.

```
CMS-example/
├── api/   NestJS + SQLite  → http://localhost:3000/api
└── web/   Angular 22 + SSR → http://localhost:4200  (panel en /admin)
```

## Requisitos

- Node.js **22.22+** o **24.15+** (lo pide Angular 22). Compruébalo con `node -v`.

## Arrancar en desarrollo

```bash
npm run install:all   # instala la raíz, api/ y web/
npm run dev           # arranca la API y Angular a la vez
```

Abre **http://localhost:4200/admin** para crear contenido y **http://localhost:4200** para ver el sitio.
La base de datos se crea sola en `api/cms.db`.

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas del esquema de contenido (api) |
| `npm run build` | Compila api y web para producción |
| `npm start` | Arranca la versión compilada: API en :3000 y sitio en :4000 |

## Cómo está organizado

### `api/` — NestJS

| Archivo | Qué es |
|---|---|
| `src/database/database.service.ts` | La conexión a SQLite y las tablas, como servicio inyectable |
| `src/content/blocks/types.ts` | La forma del contenido en TypeScript (`Block`, `Section`...) |
| `src/content/blocks/schema.ts` | Validación de bloques: solo sobrevive lo declarado |
| `src/content/blocks/page-schema.ts` | Validación de secciones y columnas (páginas) |
| `src/content/blocks/text.ts` | Extracto y exportación a Markdown |
| `src/content/content-types.ts` | Qué distingue a artículos de páginas |
| `src/content/content.service.ts` | Guardar: validar → slug → revisión → transacción |
| `src/content/admin.controller.ts` | `GET/POST/PUT /api/admin/:type[/:id]` |
| `src/content/public.controller.ts` | `GET /api/nav`, `/api/:type`, `/api/:type/:slug[/markdown]` |

### `web/` — Angular

| Carpeta / archivo | Qué es |
|---|---|
| `src/app/app.routes.ts` | URLs: `/`, `/blog/:slug`, `/:slug`, `/admin/...` |
| `src/app/app.routes.server.ts` | Sitio público con SSR; panel solo en el navegador |
| `src/app/content/` | Pintar bloques y secciones (`<app-blocks>`, `<app-sections>`) |
| `src/app/content/styles-map.ts` | Intención guardada (`"1/3+2/3"`, `"accent"`) → clases de Tailwind |
| `src/app/public/` | Portada, artículo, página, 404 |
| `src/app/admin/editor/model.ts` | El documento convertido en **señales** (fuente de verdad del editor) |
| `src/app/admin/editor/rich-text.ts` | El `contenteditable` ↔ spans |
| `src/app/admin/editor/*-editor.ts` | Lista de bloques, acordeón y secciones/columnas (con arrastrar y soltar) |
| `src/styles.css` | Tailwind: tokens de marca (`@theme`), `prose-brand` y utilidades del panel |
| `src/server.ts` | Servidor de producción: proxy `/api` → Nest + SSR |

`types.ts` existe en `api/` y en `web/` (son copias). Si cambias uno, cambia el otro.

## Producción

`npm run build && npm start`. Variables útiles:

- `DB_PATH` (api): ruta del archivo SQLite. Por defecto `cms.db`.
- `API_URL` (web): dónde está la API vista desde el servidor de Angular. Por defecto `http://localhost:3000`.
- `NG_ALLOWED_HOSTS` (web): dominios desde los que se sirve el sitio, separados por comas (p. ej. `midominio.com`).
  Angular rechaza cualquier otro por seguridad. `localhost` ya está permitido.

## Pendiente

- **No hay inicio de sesión**: cualquiera que llegue a `/admin` o a `/api/admin` puede editar.
- Subida de imágenes (ahora se pega una URL).
