# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A small block-based CMS built for learning: NestJS + SQLite API in `api/`, Angular 22 SSR site + admin panel in `web/`. Code comments, UI text and commit-facing docs are in **Spanish** and are deliberately explanatory (teaching-style); keep that tone when adding comments.

## Conventions

- Always reply to the user in Spanish.
- Single quotes and 2-space indentation (matches `.prettierrc` / `web/.editorconfig`).
- Run tests with `npm test` from the repo root.

## Commands

Run from the repo root (three separate `node_modules`: root, `api/`, `web/`):

- `npm run install:all` — install all three
- `npm run dev` — API on :3000 (watch) + `ng serve` on :4200 (proxies `/api` → :3000 via `web/proxy.conf.json`)
- `npm run build` / `npm start` — production: API on :3000, SSR site on :4000
- `npm test` — API tests (Vitest). Single file: `npm --prefix api test -- src/content/blocks/schema.spec.ts`; by name: `npm --prefix api test -- -t "<name>"`
- `npm --prefix api run lint` — oxlint (type-aware), API only

The web app currently has no spec files; the only tests are `api/src/content/blocks/schema.spec.ts`.

## Architecture

**Content is a JSON document, not HTML.** Each row's `body` column stores a versioned doc: articles are `{version:1, blocks:[...]}`, pages are `{version:1, sections:[{layout, background, columns:[{blocks}]}]}`. Inline text is `Span[]` (`{text, marks[], href?}`). The API is the trust boundary: `api/src/content/blocks/schema.ts` / `page-schema.ts` rebuild the doc keeping only declared fields ("solo sobrevive lo declarado"), and the save returns the cleaned doc so the editor replaces its state with it.

**`types.ts` is duplicated** in `api/src/content/blocks/types.ts` and `web/src/app/content/types.ts` (no shared package). Change both together.

**Content types are config-driven.** `api/src/content/content-types.ts` (`CONTENT_TYPES`) maps `articles`/`pages` to their table, revisions table, FK, validator and reserved slugs. `ContentService` is generic over that config; `ContentTypePipe` validates the `:type` route param. Every update first copies the previous row into the revisions table inside a transaction. Pages live at the site root (`/:slug`), so `admin`, `api`, `blog` are reserved slugs.

**Schema** is created at startup in `DatabaseService.createTables()` (`CREATE TABLE IF NOT EXISTS`, no migrations). `DB_PATH` env var overrides `api/cms.db`.

**Adding a text mark (format) touches both sides** — see commit 6707329 for a complete example:
- `Mark` type in both `types.ts` copies
- `ALLOWED_MARKS` in `api/.../schema.ts`, Markdown export in `api/.../text.ts`, plus spec cases
- `MARKS` registry in `web/src/app/content/marks.ts` (a `Record<Mark, …>`, so the compiler flags a missing entry). It drives public rendering (`inline-html.ts` → `spansToHtml`), editor HTML parsing (`rich-text.ts`) and the toolbar buttons (`editor-page.ts`). Marks without an `execCommand` are applied by `wrapSelection` in `rich-text.ts`.
- Styles in `web/src/styles.css`

**Rendering inline HTML safely:** public text is rendered via `innerHTML` of `spansToHtml()` output. Safety relies on three layers (escaping in `spansToHtml`, Angular sanitization, API validation); don't bypass any of them.

**Web app:** public routes are SSR-rendered and the `/admin` panel is browser-only (`app.routes.server.ts`). API calls always use relative `/api/...` URLs. In production, `web/src/server.ts` proxies `/api` to Nest (`API_URL`, default `http://localhost:3000`), and `NG_ALLOWED_HOSTS` must list the production domains. Stored layout/background values (`"1/3+2/3"`, `"accent"`) are intents, mapped to Tailwind classes only in `web/src/app/content/styles-map.ts`. The editor's source of truth is the signal model in `admin/editor/model.ts`; drag and drop uses Angular CDK. Styling is Tailwind 4 with brand tokens in `@theme` in `styles.css`.

## Known gaps

There is no authentication: anyone reaching `/admin` or `/api/admin` can edit. Images are URLs only (no upload).
