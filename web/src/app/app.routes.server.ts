import { RenderMode, ServerRoute } from '@angular/ssr';

// Cómo se renderiza cada ruta:
//   - Server: en cada visita, el servidor pide los datos a la API y devuelve el
//     HTML completo. Bueno para SEO y para que el contenido se vea al instante.
//   - Client: el servidor devuelve una página vacía y Angular la monta en el
//     navegador. Para el panel no hace falta SEO, y el editor necesita el navegador
//     (contenteditable, selección de texto...).
//   - (Prerender, que no usamos: HTML generado una vez al compilar. Sirve para
//     páginas que no cambian; aquí el contenido cambia al publicar.)
export const serverRoutes: ServerRoute[] = [
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
