// server.ts — El servidor de PRODUCCIÓN del sitio Angular (npm run serve:ssr:web)
//
// Hace tres cosas, en este orden:
//   1. /api/...      -> lo reenvía a la API de Nest (así el navegador solo habla
//                       con un servidor y no hay problemas de CORS)
//   2. archivos      -> sirve el JavaScript y CSS ya compilados
//   3. todo lo demás -> Angular lo renderiza (SSR) y devuelve el HTML
//
// En desarrollo (ng serve) no se usa este archivo para el paso 1: lo hace proxy.conf.json.

import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');
const apiUrl = process.env['API_URL'] ?? 'http://localhost:3000';

const app = express();
const angularApp = new AngularNodeAppEngine();

// 1. Proxy hacia Nest
app.use('/api', createProxyMiddleware({ target: `${apiUrl}/api`, changeOrigin: true }));

// 2. Archivos estáticos
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

// 3. Angular
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`Sitio Angular en http://localhost:${port}  (API: ${apiUrl})`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
