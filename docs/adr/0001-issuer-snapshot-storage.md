# ADR 0001: snapshots de emisor embebidos por documento

## Contexto

Los datos comerciales de una empresa (dirección, cobro, identidad visual y logo) pueden
cambiar después de que una factura se emita o un presupuesto se envíe. El PDF histórico
no puede depender del perfil actual ni de un asset que el usuario pueda borrar.

## Decisión

Cada factura y presupuesto conserva un `issuer_snapshot` JSONB versionado y, cuando
existe, una copia inmutable de los bytes del logo con su MIME y SHA-256 en la propia
fila documental. El JSONB es el contrato canónico de presentación; los bytes quedan
fuera de él para evitar base64, límites imprecisos y exposiciones accidentales en API.

El snapshot se actualiza al crear o editar un borrador. Se vuelve a capturar dentro de
la transacción que emite una factura o que cambia un presupuesto de `DRAFT` a `SENT`.
No se vuelve a leer el perfil vivo al renderizar un documento congelado.

La migración rellena facturas existentes solo con `issuer_legal_name` y
`issuer_tax_id`, que ya eran datos históricos. Los presupuestos existentes reciben un
snapshot mínimo con `source: legacy_backfill`; no se completa dirección, IBAN ni logo a
partir del perfil actual.

## Consecuencias

- El historial conserva exactamente el logo aunque se elimine el activo de empresa.
- Se repiten como máximo 512 KiB de logo por documento; es un coste aceptable para el
  alcance actual y evita introducir object storage o referencias con ciclos de vida.
- Las respuestas API omiten los bytes del logo. Una evolución de formato incrementará
  `snapshotVersion` y conservará el lector de la versión anterior.
