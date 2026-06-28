# Simple POS Reports

## Alcance

Este documento describe la implementación de reportes POS simple para tenants con:

- `module_key = sales_pos`
- `tenant_modules.config.pos_type = simple`
- acceso RBAC `reports = read` o superior

La experiencia vive en `/${tenantSlug}/pos/reports` con vistas URL-backed:

- `?view=income`
- `?view=products`
- `?view=orders`

## Tablas usadas

- `public.report_sales_daily`
- `public.orders`
- `public.order_items`
- `public.catalog_items`
- `public.catalog_categories`

## Por qué no se usan `sales_accounts`

`expo-cuu` opera sobre el modelo clásico de POS simple:

- `orders`
- `order_items`
- `catalog_items`
- `catalog_categories`

Las tablas:

- `sales_accounts`
- `sales_account_lines`
- `sales_account_payments`

pertenecen al POS configurable / variants y no deben mezclarse con reportes POS simple.

## Vistas implementadas

### Income

- KPIs:
  - ingresos
  - órdenes
  - ticket promedio
  - pagadas / impresas
- Tendencias:
  - ingresos por día
  - órdenes por día
- Fuente principal:
  - `report_sales_daily`
- Conteos complementarios:
  - `orders`

### Products

- Top productos por cantidad
- Top productos por ingresos
- Tabla de productos vendidos
- Fuente:
  - `order_items` filtrado por `orders.status = 'PAID'`
  - enriquecido con `catalog_items` y `catalog_categories`

### Orders

- Tabla paginada de órdenes
- Detalle de orden bajo demanda con `orderId`
- Fuente:
  - `orders`
  - `order_items` de una sola orden

## Reglas de performance

- `income` usa `report_sales_daily` como agregado diario principal.
- `orders` usa paginación server-side de 50 filas por página.
- `products` no consulta por fila y no hace N+1.
- `products` usa joins batched sobre `order_items + orders + catalogo`.
- El rango se limita a 31 días para mantener tiempos de respuesta consistentes.
- El detalle de orden carga sólo los items de la orden seleccionada.
- No se usan endpoints API productivos.
- No se escriben datos operativos.

## Relación con RBAC modular

- Requiere `sales_pos`
- Requiere page access `reports = read` o superior
- La rama `simple` se resuelve por `pos_type = simple`
- Las subrutas legacy de `variants` siguen protegidas para `variants`

## Relación con `pos_type`

- `simple`:
  - usa `/${tenantSlug}/pos/reports?view=*`
- `variants`:
  - conserva la experiencia existente basada en `sales_accounts`
- `retail`:
  - no aplica en esta ruta

## Pendientes

- Si en producción aparecen volúmenes mucho mayores para `products`, conviene migrar esa vista a una RPC read-only o tabla agregada dedicada.
- Si se requiere exportación CSV/XLSX, debe implementarse sobre los mismos filtros server-side.
- Si se necesita detalle de órdenes por cliente/source, primero debe confirmarse una columna fuente consistente en `orders`.
