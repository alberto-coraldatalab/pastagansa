# Plan de producto usable

## Decisión

Desde septiembre de 2026, la prioridad inmediata de PastaGansa es convertir el
backend validado en una aplicación que una persona pueda utilizar sin herramientas de
desarrollo. La ampliación fiscal avanzada continúa en el roadmap, pero se retoma
después de superar este hito salvo que desbloquee un recorrido crítico.

Este plan es un overlay de entrega. No sustituye las fases funcionales ni cambia sus
estados: reorganiza el trabajo pendiente alrededor de resultados observables por el
usuario.

## Usuario y escenario inicial

El primer usuario objetivo es una pyme española de servicios con una empresa, IVA
nacional ordinario y un propietario que también administra la cuenta.

Al terminar el hito podrá:

1. registrarse o iniciar sesión;
2. reconocer la empresa activa y cambiar su configuración básica;
3. crear un cliente y un producto o servicio;
4. preparar, emitir y descargar una factura;
5. consultar su vencimiento y registrar un cobro;
6. registrar una factura de proveedor con adjunto, revisar OCR si procede y aprobarla;
7. registrar su pago;
8. comprobar el efecto básico en ventas, compras, saldo pendiente y contabilidad.

## Definición de producto usable

El hito solo se cierra cuando una persona no desarrolladora puede completar los dos
recorridos críticos desde un navegador, sin Swagger, SQL ni ayuda correctiva del
equipo:

```text
Venta
registro → cliente → servicio → borrador → emisión → PDF → cobro

Compra
proveedor → borrador → adjunto → OCR/revisión → aprobación → pago
```

Además:

- el entorno se levanta con instrucciones reproducibles;
- existe un dataset demo determinista y reiniciable;
- carga, vacío, error, permiso denegado y conflicto tienen estados comprensibles;
- ninguna acción crítica se presenta como completada antes de confirmación del API;
- los importes y fechas se muestran en formato español;
- teclado, foco, etiquetas y contraste cubren el recorrido crítico;
- una prueba E2E de navegador protege cada recorrido;
- existe un staging accesible, con logs, healthcheck y procedimiento de recuperación;
- no se exponen secretos ni datos demo reales.

## Arquitectura de entrega

Se añade `apps/web` al monorepo con Next.js, React y TypeScript, siguiendo la
especificación técnica existente. La primera versión utilizará:

- componentes accesibles y tokens definidos en la especificación UI/UX;
- TanStack Query para estado remoto;
- React Hook Form y Zod para formularios;
- un cliente tipado y una única capa para autenticación, tenant, errores e
  idempotencia;
- Playwright para recorridos E2E de navegador.

No se duplicarán reglas fiscales o contables en el frontend. El API sigue siendo la
fuente de verdad y la web muestra sus resultados y conflictos.

## Plan de slices

### U0 — Arranque reproducible y demo

Resultado: cualquier colaborador puede levantar la aplicación y obtener una empresa
demo coherente con un procedimiento documentado.

Entregables:

- comandos raíz para desarrollo coordinado de API y web;
- seed idempotente con empresa, usuario, cliente, proveedor, servicio, series y cuenta
  bancaria;
- configuración de desarrollo y comprobación de health;
- documento corto “probar el producto”;
- CI preparado para instalar y construir ambos workspaces.

Gate:

- repositorio limpio → instalación → base de datos → migraciones → seed → aplicación;
- las credenciales demo y la forma de reiniciar datos están documentadas;
- ejecutar el seed dos veces no duplica datos.

### U1 — Web foundation y acceso

Resultado: el usuario entra en una aplicación reconocible y aterriza en su empresa.

Estado real: en curso. Ya existen el workspace Next.js integrado en lint, build y
tests del monorepo; registro/login/logout; renovación de sesión mediante cookies
HTTP-only; descubrimiento autenticado de membresías bajo RLS; selección de la primera
empresa activa; shell responsive y estados de carga/error. Pendientes selector
multiempresa, pruebas E2E de navegador y comprobaciones automáticas de accesibilidad
para superar el gate completo.

Entregables:

- shell responsive, navegación principal y dirección visual lima;
- registro, login, persistencia/renovación de sesión y logout;
- contexto visible de organización y empresa;
- rutas protegidas y tratamiento de sesión caducada;
- cliente API, feedback de carga, errores y notificaciones;
- página inicial con próximos pasos reales, no métricas ficticias.

Gate:

- registro y login funcionan desde navegador;
- recargar conserva una sesión válida y una sesión revocada vuelve al login;
- nunca se consulta una empresa sin contexto tenant validado;
- pruebas de componentes críticos y E2E de acceso en CI.

### U2 — Venta usable

Resultado: el usuario convierte datos maestros en una factura real descargable.

Estado real: en curso. Ya están disponibles la cartera de clientes y el catálogo de
productos/servicios, ambos con navegación desde el shell, búsqueda, paginación por
cursor, estados de carga/vacío/error y alta validada. El catálogo conserva precio,
unidad, IVA sugerido y cuenta de ingresos reutilizables. La web mantiene tokens y
tenant en servidor y presenta NIF o SKU duplicados como conflictos recuperables.
Falta el recorrido de factura para superar el gate.

Entregables:

- listas y formularios mínimos de clientes y catálogo;
- listado, creación y edición de factura borrador;
- editor de líneas con totales devueltos por el API;
- selección de serie y emisión con confirmación explícita;
- detalle inmutable, descarga de PDF, vencimientos y registro de cobro;
- enlaces al asiento y Tax Ledger cuando existan.

Gate:

- E2E `cliente → factura → emisión → PDF → cobro`;
- doble clic o retry no duplica emisión ni cobro;
- errores de validación y conflicto indican cómo continuar;
- el estado mostrado tras recarga coincide con PostgreSQL.

Este gate constituye el **primer incremento usable** y tiene prioridad sobre U3 y U4.

### U3 — Compra usable

Resultado: el usuario registra y paga una compra con control humano del OCR.

Entregables:

- listado y editor de facturas de proveedor;
- subida y descarga de adjuntos;
- solicitud, progreso y reintento de OCR para PNG/JPEG;
- comparación clara entre extracción y corrección humana;
- aprobación simple o multinivel según política;
- vencimientos y registro de pago;
- enlaces al asiento y Tax Ledger.

Gate:

- E2E `proveedor → compra → adjunto → OCR/revisión → aprobación → pago`;
- nunca se aprueba una extracción pendiente de revisión;
- permisos y estado explican por qué una acción no está disponible;
- PDF se acepta como adjunto y no se ofrece falsamente como OCR compatible.

### U4 — Visibilidad y staging

Resultado: los recorridos se pueden evaluar de forma autónoma en un entorno estable.

Entregables:

- inicio con ventas, compras y saldos pendientes básicos;
- vistas mínimas de diario, mayor y conciliación bancaria existente;
- configuración SMTP de staging y estado observable del envío;
- despliegue repetible de web, API y PostgreSQL;
- logs correlacionados, healthcheck, métricas y alertas mínimas;
- backup y restauración ensayados;
- guion de prueba moderada con al menos una persona ajena al desarrollo.

Gate:

- los E2E críticos pasan contra staging;
- una factura puede enviarse a una bandeja de pruebas y auditarse;
- restauración documentada y ensayada;
- cero bloqueadores de severidad crítica o alta en el recorrido usable;
- incidencias de la prueba moderada clasificadas antes de cerrar el hito.

## Orden inmediato de implementación

1. Crear `apps/web` y el pipeline de build/test.
2. Implementar cliente API, sesión y contexto tenant.
3. Entregar login/registro y shell navegable.
4. Añadir seed/demo reproducible.
5. Construir el recorrido de venta hasta PDF y cobro.
6. Construir el recorrido de compra hasta OCR, aprobación y pago.
7. Desplegar staging, completar visibilidad y ejecutar la prueba moderada.

U0 y U1 pueden avanzar en paralelo conceptualmente, pero cada commit debe dejar el
repositorio arrancable. Dentro de U2 y U3 se priorizan slices verticales pequeños sobre
la creación masiva de componentes o pantallas vacías.

## Alcance aplazado hasta superar el hito

- inversión del sujeto pasivo y casuística intracomunitaria avanzada;
- modelos fiscales y libros completos;
- SIF/VERI*FACTU;
- pedidos, albaranes y recurrencia;
- conciliación parcial/combinada y Open Banking;
- dashboards analíticos avanzados;
- personalización visual amplia, dark mode y PWA;
- OCR PDF y sustitución del almacenamiento de adjuntos.

No se aplazan correcciones de seguridad, aislamiento tenant, integridad contable o
fiscal, pérdida de datos ni fallos que bloqueen los recorridos del hito.

## Métricas del hito

- tiempo desde registro hasta primera factura emitida;
- porcentaje de recorridos completados sin ayuda;
- errores de formulario por recorrido;
- abandonos por paso;
- fallos E2E y regresiones en CI;
- accesibilidad automática del recorrido crítico;
- errores 5xx y latencia percibida en staging.

Objetivo inicial: una persona familiarizada con facturación, pero no con el proyecto,
emite y descarga su primera factura en menos de diez minutos usando los datos demo.

## Regla para aceptar nuevo alcance

Hasta cerrar el Hito U, una nueva historia entra en prioridad solo si:

1. desbloquea uno de los recorridos críticos;
2. corrige seguridad, aislamiento, integridad o pérdida de datos;
3. reduce un riesgo operativo del staging;
4. es obligatoria por una fecha normativa anterior al cierre previsto del hito.

Cualquier otra capacidad permanece en el backlog original.
