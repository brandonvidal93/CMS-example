// SQLite guarda las fechas como "2026-10-27 19:23:00" en UTC, sin zona horaria.
// Lo convertimos a un formato que DatePipe entiende sin ambigüedad.
export const sqlDate = (s: string | null | undefined) => (s ? s.replace(' ', 'T') + 'Z' : null);
