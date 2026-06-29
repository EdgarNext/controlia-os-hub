# RFC: Retail POS Offline Local Folio v2

Status: Proposed  
Date: 2026-06-28

## Problema

Retail POS opera en modo offline-first para pedidos. Hoy la idempotencia tecnica de creacion y sync esta correctamente protegida por `tenant_id + origin_client_order_id`, pero el folio local operativo no esta optimizado para operacion multiestacion offline.

El esquema actual de `local_folio`:
- no usa `station_number` / `kiosk_number`;
- no distingue claramente `backoffice_station` de `order_station`;
- depende parcialmente de `deviceId`;
- no esta pensado para captura manual rapida en caja;
- no se conserva hoy en Hub para busqueda posterior.

Esto crea friccion operativa cuando:
- el ticket se imprime sin conectividad;
- caja cobra manualmente fuera del sistema;
- el pedido sincroniza despues;
- caja necesita registrar el cobro usando el folio del ticket.

## Objetivos

- Definir un folio local offline legible, estable y unico entre estaciones.
- Permitir operacion continua sin internet.
- Imprimir siempre un folio util en ticket.
- Hacer convivir el folio local con el folio remoto `RP-YYMMDD-000X`.
- Permitir que caja acepte tanto folio remoto como local.
- Mantener intacta la idempotencia tecnica existente basada en `origin_client_order_id`.

## No objetivos

- No cambiar la idempotencia tecnica actual.
- No cambiar el formato del folio remoto `RP-...`.
- No redisenar POS-Kiosk.
- No implementar pagos offline en esta RFC.
- No migrar retrospectivamente pedidos historicos.
- No tocar `/api/pos/claim`.

## Decision propuesta

Se adopta un nuevo formato de folio local offline:

`NNNN-KKK-YYMMDD`

Ejemplo:

`0001-905-260628`

Semantica:
- `NNNN`: consecutivo diario de 4 digitos por estacion.
- `KKK`: `station_number` / `kiosk_number`.
- `YYMMDD`: fecha local operativa.

El folio local:
- se genera localmente en Edge;
- se imprime siempre en el ticket de pedido;
- se envia al Hub al sincronizar;
- se guarda en Hub como `origin_local_folio`;
- se usa para busqueda en caja junto con `remote_folio`.

## Formato del folio local

Formato canonico:

`NNNN-KKK-YYMMDD`

Ejemplos validos:
- `0001-905-260628`
- `0002-905-260628`
- `0001-906-260628`
- `0001-907-260628`

## Reglas de generacion

1. `NNNN` debe ir de `0001` a `9999`.
2. La secuencia debe ser por estacion y por fecha local operativa.
3. La secuencia debe reiniciar diariamente por estacion.
4. `KKK` debe provenir de `station_number` / `kiosk_number` resuelto en bootstrap.
5. No se deben usar los ultimos digitos de `deviceId`.
6. Si `station_number` no esta disponible, la terminal debe quedar en estado no apto para crear pedidos o usar un fallback explicito y visible aprobado por producto. No se permite fallback silencioso ambiguo.
7. `YYMMDD` debe usar la fecha local operativa de la instalacion. Recomendacion actual: zona local de operacion `America/Mexico_City`, o la zona operativa explicita disponible en runtime si la app la soporta formalmente.
8. Si una estacion supera `9999` pedidos en un dia:
   - recomendacion primaria: bloquear creacion y mostrar error operativo claro;
   - no extender formato automaticamente sin una decision explicita posterior, para no romper captura manual, tickets ni normalizacion.
9. El `origin_client_order_id` debe seguir siendo la clave de idempotencia tecnica y no depende del folio.

## Normalizacion de entrada manual

Caja y lectores deben aceptar al menos:
- `0001-905-260628`
- `0001905260628`

Regla de normalizacion:
- eliminar espacios;
- aceptar mayusculas/minusculas cuando aplique;
- reinsertar guiones si la cadena coincide con el patron `NNNNKKKYYMMDD`;
- conservar `RP-...` con su normalizacion existente.

## Reglas de impresion

En ticket de pedido:

Siempre imprimir:
- `Folio pedido: <local_folio>`

Si ya existe remoto, imprimir ademas:
- `Folio sistema: <remote_folio>`

Si no existe remoto, imprimir ademas un estado operativo claro:
- `Pendiente de sincronizar`
- `Cobro manual / registrar en sistema al recuperar conexion`

Barcode / codigo escaneable:
- para ticket offline, debe codificar preferentemente `local_folio`;
- cuando exista `remote_folio`, recomendacion inicial:
  - mantener `local_folio` como barcode principal en ticket de pedido;
  - imprimir `remote_folio` en texto como referencia de sistema.

Razonamiento:
- el ticket nace offline;
- el folio local es el identificador estable del papel entregado al cliente;
- evita que el codigo cambie de semantica entre antes y despues del sync.

## Reglas de busqueda en caja

Caja debe aceptar:
- `RP-260628-0001`
- `0001-905-260628`
- entradas sin guiones si la normalizacion las reconoce

Regla de busqueda recomendada:
1. normalizar entrada;
2. si parece `RP-...`, buscar por `retail_pos_orders.folio`;
3. si parece folio local, buscar por `retail_pos_orders.origin_local_folio`;
4. opcionalmente, usar una busqueda unificada que pruebe ambos caminos.

Comportamiento esperado:
- si encuentra por folio local y la orden esta `pending_payment`, puede cobrar;
- si la orden aun no ha sincronizado, no existira en Hub y caja online no podra cobrar en sistema;
- la UI debe distinguir:
  - no encontrado porque aun no sincroniza;
  - no encontrado real;
  - ya pagado;
  - cancelado.

## Cambios requeridos en Edge

1. Reemplazar la generacion actual de `local_folio` por el formato `NNNN-KKK-YYMMDD`.
2. Cambiar la persistencia de secuencia local para que sea por estacion y por dia, no global.
3. Requerir `station_number` / `kiosk_number` valido para habilitar creacion de pedidos.
4. Enviar `local_folio` al Hub durante `createOrder` / sync.
5. Ajustar ticket preview y ticket impreso para etiquetar explicitamente:
   - `Folio pedido`
   - `Folio sistema`
6. Ampliar la normalizacion de folios en caja para aceptar el nuevo formato local.
7. Ajustar mensajes de UI para separar mejor:
   - pedido aun no sincronizado;
   - pedido no encontrado;
   - pedido ya pagado;
   - pedido cancelado.

## Cambios requeridos en Hub

1. Agregar campo `origin_local_folio text null` en `retail_pos_orders`.
2. Recibir `local_folio` desde Edge al crear/sincronizar pedido.
3. Persistir `origin_local_folio` en la orden.
4. Agregar indice sobre:
   - `tenant_id, origin_local_folio`
5. Recomendacion de constraint:
   - `unique (tenant_id, origin_local_folio)` parcial cuando `origin_local_folio is not null`
6. Ampliar lookup de caja para buscar por:
   - `folio`
   - `origin_local_folio`
7. No alterar el formato ni la logica del `remote_folio`.

## Compatibilidad con pedidos existentes

- Pedidos locales existentes con formato viejo deben seguir visibles localmente.
- Pedidos remotos historicos pueden no tener `origin_local_folio`.
- No se requiere migracion de historico como prerequisito.
- `RP-...` no cambia.
- Lookup nuevo debe tolerar `origin_local_folio = null` sin romper ordenes antiguas.

## Riesgos

1. Dependencia de `station_number`
   - Si bootstrap no lo resuelve, no se puede generar el folio propuesto de forma segura.

2. Ambiguedad por zona horaria
   - Si la fecha no usa una zona operativa consistente, la secuencia diaria puede reiniciar en momentos incorrectos.

3. Saturacion de `9999` pedidos/dia/estacion
   - Poco probable, pero debe quedar definida la conducta.

4. Convivencia de formatos viejos y nuevos
   - Durante transicion coexistiran tickets con folio local legado y v2.

## Mitigaciones

- Validar `station_number` como prerequisito operativo.
- Definir formalmente la zona horaria operativa.
- Bloquear al llegar a `9999` con mensaje claro en vez de extender formato sin contrato.
- Mantener compatibilidad de lectura con formatos antiguos donde aplique.
- No mezclar folio local con idempotencia tecnica.

## Fases de implementacion

### Fase 1 - Edge folio local v2

- Generar `NNNN-KKK-YYMMDD`.
- Secuencia diaria por estacion.
- Ticket imprime `Folio pedido` claro.
- Barcode usa `local_folio`.
- No depende todavia de cambios en Hub para seguir operando offline.

### Fase 2 - Hub guarda y busca folio local

- Migracion para `origin_local_folio`.
- Edge envia `local_folio`.
- Hub guarda `origin_local_folio`.
- Caja busca por remoto o local.

### Fase 3 - UX de caja y compatibilidad operacional

- Mensajes diferenciados de no sincronizado / no encontrado / pagado / cancelado.
- Afinar normalizacion de captura manual y lector.
- Verificacion operativa con tickets reales de transicion.

## Criterios de aceptacion

- Dos `order_station` y un `backoffice_station` autorizado pueden generar pedidos offline sin ambiguedad operativa de folio.
- El folio local es legible y facil de teclear en caja.
- El ticket siempre muestra un folio operativo utilizable.
- El `remote_folio` sigue existiendo sin cambios.
- Caja puede aceptar tanto `RP-...` como `NNNN-KKK-YYMMDD`.
- Hub conserva `origin_client_order_id` como idempotencia tecnica.
- Pedidos existentes no se rompen aunque no tengan `origin_local_folio`.
- La implementacion puede ejecutarse por fases sin bloquear operacion offline actual.

## Fundamentacion breve del estado actual

Edge actual:
- genera `local_folio` sin `station_number` y con dependencia parcial de `deviceId`;
- imprime hoy `remote_folio` como principal si existe, si no `local_folio`;
- ya dispone de `station_number` en el runtime bootstrap local.

Hub actual:
- no guarda `local_folio`;
- caja busca solo por `retail_pos_orders.folio`;
- la idempotencia tecnica actual ya esta correctamente resuelta por `tenant_id + origin_client_order_id`.

Contexto funcional explicito:
- pedidos son offline-first;
- pagos siguen online por ahora;
- si no hay red, caja puede cobrar manualmente fuera de la plataforma usando ticket;
- cuando vuelve la conexion, caja debe poder registrar o cobrar en sistema usando el folio del ticket;
- `local_folio` no sustituye a `origin_client_order_id`;
- `origin_client_order_id` sigue siendo la idempotencia tecnica;
- `RP-...` no cambia;
- POS-Kiosk no entra en alcance;
- `/api/pos/claim` no entra en alcance;
- no se migran pedidos historicos como prerequisito.
