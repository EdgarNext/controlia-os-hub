# Segment Starter (Template)

Plantillas base para nuevos segmentos App Router en `apps/hub`.

Uso sugerido:
1. Copiar `loading.tsx`, `error.tsx` y `not-found.tsx` al nuevo segmento real.
2. Ajustar copy y acciones segun el dominio.
3. Mantener `StatePanel` como base para estados `error/empty/permission`.

Reglas:
- No mover esta carpeta a una ruta real del modulo.
- Mantener estas plantillas como referencia comun, no como implementacion final.
- Si un segmento omite alguno de estos archivos, debe justificarlo en PR.
