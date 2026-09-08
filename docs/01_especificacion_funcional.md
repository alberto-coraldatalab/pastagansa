# Especificación funcional
## ERP SaaS de gestión, facturación, contabilidad y fiscalidad para España

**Versión:** 1.0  
**Fecha de referencia normativa:** 8 de septiembre de 2026  
**Estado:** Especificación base para producto, UX, desarrollo y validación fiscal  
**Ámbito principal:** España, territorio IVA estatal; extensible posteriormente a IGIC, IPSI y territorios forales.

> **Nota de cumplimiento:** este documento define un producto diseñado para ajustarse al marco contable y fiscal español. La puesta en producción de cada versión deberá someterse a revisión normativa y validación por especialistas contables/fiscales, especialmente cuando cambien modelos, esquemas AEAT, tipos, regímenes o especificaciones SIF.

---

# 1. Objetivo del producto

Construir un ERP SaaS multiempresa, comparable funcionalmente a soluciones de gestión empresarial como Holded, capaz de cubrir de extremo a extremo:

- ventas y facturación;
- compras y gastos;
- clientes y proveedores;
- productos y servicios;
- bancos y conciliación;
- contabilidad;
- IVA;
- IRPF y retenciones;
- libros fiscales;
- modelos tributarios;
- inventario;
- CRM;
- proyectos;
- recursos humanos;
- portal de cliente;
- TPV;
- analítica;
- integraciones y API;
- requisitos SIF/VERI*FACTU;
- factura electrónica B2B mediante adaptadores, cuando resulte aplicable.

El sistema debe evitar la duplicidad de datos entre gestión, contabilidad y fiscalidad. Un mismo hecho económico debe producir, mediante reglas trazables, su documento comercial, efectos contables, efectos fiscales, movimientos de tesorería y analítica.

---

# 2. Principios funcionales

1. **Una fuente de verdad por hecho económico.**
2. **Documentos emitidos inmutables.**
3. **Correcciones mediante rectificación/reversión, no edición destructiva.**
4. **Contabilidad automática pero revisable.**
5. **Fiscalidad derivada de un ledger fiscal, no directamente de la UI.**
6. **Reglas fiscales versionadas por vigencia.**
7. **Multiempresa con aislamiento estricto por NIF.**
8. **Trazabilidad completa de cambios y acciones sensibles.**
9. **Automatización con posibilidad de intervención humana cuando exista ambigüedad.**
10. **Exportabilidad completa de los datos.**
11. **Compatibilidad con formatos y servicios oficiales cuando proceda.**
12. **Diseño preparado para asesorías y colaboración cliente-gestor.**

---

# 3. Perfiles de usuario

## 3.1 Propietario / administrador

Puede:

- crear y configurar empresas;
- gestionar suscripción;
- administrar usuarios y permisos;
- configurar series, impuestos, bancos e integraciones;
- consultar todos los módulos;
- aprobar cierres y reaperturas según permisos.

## 3.2 Contable

Puede:

- revisar asientos automáticos;
- crear asientos manuales;
- conciliar cuentas;
- gestionar cierres;
- consultar balances;
- gestionar activos;
- revisar diferencias entre contabilidad y fiscalidad.

## 3.3 Asesor fiscal / gestoría

Puede:

- acceder a una o varias empresas asignadas;
- revisar libros;
- calcular declaraciones;
- bloquear periodos;
- exportar información;
- registrar datos de presentación;
- consultar auditoría fiscal.

## 3.4 Finanzas / tesorería

Puede:

- consultar bancos;
- importar extractos;
- conciliar;
- registrar cobros y pagos;
- revisar previsiones;
- gestionar remesas en fases posteriores.

## 3.5 Comercial

Puede:

- gestionar leads y clientes;
- crear oportunidades;
- generar presupuestos;
- convertir presupuestos en pedidos/facturas;
- consultar únicamente su cartera si así se configura.

## 3.6 Compras

Puede:

- gestionar proveedores;
- registrar pedidos;
- cargar facturas;
- revisar OCR;
- aprobar gastos;
- asociar costes a proyectos o centros.

## 3.7 Responsable de proyecto

Puede:

- crear proyectos;
- asignar miembros;
- planificar tareas;
- revisar horas y costes;
- facturar hitos u horas.

## 3.8 RR. HH.

Puede:

- gestionar empleados;
- vacaciones y ausencias;
- control horario;
- documentos;
- nóminas importadas o generadas según fase.

## 3.9 Empleado

Puede:

- registrar horas;
- solicitar vacaciones;
- consultar documentos autorizados;
- imputar gastos y dietas cuando se habilite.

## 3.10 Cliente final

Desde el portal:

- visualiza presupuestos;
- acepta/rechaza;
- descarga facturas;
- consulta saldo;
- realiza pagos mediante pasarela;
- comparte documentación autorizada.

---

# 4. Estructura multiempresa

Jerarquía funcional:

```text
Organización
└── Empresa / entidad fiscal
    ├── Usuarios y permisos
    ├── Ejercicios
    ├── Series
    ├── Contabilidad
    ├── Perfil fiscal
    ├── Bancos
    ├── Inventario
    └── Integraciones
```

Cada empresa debe tener de forma independiente:

- NIF;
- denominación;
- domicilio fiscal;
- ejercicio;
- plan contable;
- series de documentos;
- números de factura;
- impuestos;
- modelos;
- certificados;
- registros SIF;
- libros;
- bancos;
- almacenes;
- contactos;
- auditoría.

Nunca se permitirá compartir una secuencia fiscal entre entidades con NIF distinto.

---

# 5. Alta y configuración inicial

## 5.1 Wizard de alta

Pasos:

1. Tipo de entidad.
2. NIF y razón social.
3. Dirección fiscal.
4. Actividad.
5. Ejercicio contable.
6. PGC, PGC-Pymes o libros IRPF.
7. Régimen de IVA.
8. Régimen de IRPF/IS.
9. Periodicidad fiscal.
10. Retenciones aplicables.
11. SII.
12. SIF/VERI*FACTU.
13. Series de facturación.
14. Datos bancarios.
15. Logo y plantilla.
16. Importación opcional.

## 5.2 Perfil fiscal

Debe parametrizar:

- sociedad/autónomo/otra entidad;
- PGC o PGC-Pymes cuando corresponda;
- estimación directa normal/simplificada u otros regímenes;
- IVA general o especial;
- periodicidad mensual/trimestral;
- SII;
- retenciones profesionales;
- retenciones de alquiler;
- modelos potencialmente aplicables;
- fecha de vigencia.

Los modelos deben activarse según obligaciones reales, no simplemente por existir en el producto.

---

# 6. Dashboard

## 6.1 Indicadores principales

- ventas del mes/año;
- compras y gastos;
- margen;
- beneficio contable estimado;
- facturas pendientes;
- vencidos;
- previsión de cobros/pagos;
- saldo bancario;
- tesorería proyectada;
- IVA repercutido;
- IVA soportado;
- IVA deducible;
- retenciones practicadas;
- retenciones soportadas;
- stock bajo;
- oportunidades CRM;
- rentabilidad de proyectos.

## 6.2 Filtros

- empresa;
- fecha;
- cliente/proveedor;
- comercial;
- proyecto;
- centro de coste;
- almacén;
- etiqueta.

## 6.3 Alertas

- facturas vencidas;
- gastos pendientes de aprobar;
- conciliaciones pendientes;
- diferencias contable-fiscales;
- stock por debajo del mínimo;
- periodos fiscales próximos a cierre;
- errores de remisión SIF/SII;
- integraciones desconectadas.

---

# 7. Contactos

Entidad unificada de contacto con roles:

- lead;
- cliente;
- proveedor;
- cliente y proveedor;
- empleado relacionado;
- otro tercero.

## 7.1 Datos

- razón social/nombre;
- nombre comercial;
- NIF/VAT ID;
- país;
- dirección fiscal;
- direcciones de envío;
- contactos personales;
- teléfono/email;
- cuenta bancaria;
- moneda;
- idioma;
- condiciones de pago;
- descuento;
- cuentas contables sugeridas;
- reglas fiscales sugeridas;
- etiquetas;
- notas;
- adjuntos.

## 7.2 Validaciones

- formato de NIF según país;
- duplicidad configurable;
- VIES en operaciones intracomunitarias cuando sea útil;
- identificación de país/territorio fiscal;
- bloqueo preventivo si faltan datos fiscales obligatorios para emitir.

## 7.3 Vista 360º

Mostrar:

- presupuestos;
- pedidos;
- facturas;
- compras;
- pagos;
- oportunidades;
- proyectos;
- documentos;
- actividad;
- saldo contable;
- riesgo comercial en fase posterior.

---

# 8. Productos y servicios

## 8.1 Producto

Campos:

- SKU;
- EAN;
- nombre;
- descripción;
- categoría;
- marca;
- unidad;
- precio;
- coste;
- regla fiscal;
- cuenta contable;
- imágenes;
- variantes;
- stock;
- proveedor preferente.

## 8.2 Servicio

Campos:

- código;
- nombre;
- descripción;
- tarifa;
- coste estimado;
- unidad facturable;
- regla fiscal;
- cuenta de ingresos.

## 8.3 Tarifas

- tarifa general;
- tarifa por cliente;
- tarifa por volumen;
- tarifa por moneda;
- vigencia por fechas.

---

# 9. Ventas y facturación

## 9.1 Documentos

- presupuesto;
- pedido;
- albarán;
- factura completa;
- factura simplificada;
- factura recurrente;
- factura rectificativa;
- factura de anticipo;
- proforma como documento no fiscal.

## 9.2 Flujo

```text
Lead
→ Cliente
→ Presupuesto
→ Pedido
→ Albarán
→ Factura
→ Registro fiscal
→ Asiento
→ Cobro
→ Banco
→ Conciliación
```

Los pasos intermedios pueden omitirse según negocio.

## 9.3 Estados de presupuesto

- borrador;
- enviado;
- visto;
- aceptado;
- rechazado;
- vencido;
- convertido.

## 9.4 Estados de factura

- borrador;
- emitida;
- enviada;
- parcialmente cobrada;
- cobrada;
- vencida;
- rectificada.

No debe existir un estado funcional que permita convertir una factura emitida en borrador conservando el mismo número.

## 9.5 Emisión

Al emitir:

1. validar datos de emisor/receptor;
2. validar líneas e impuestos;
3. asignar serie/número;
4. congelar desglose económico;
5. congelar desglose fiscal;
6. generar efectos contables;
7. generar ledger fiscal;
8. generar registro SIF cuando aplique;
9. generar PDF;
10. crear evento de dominio.

Todo el proceso debe ser atómico desde el punto de vista de integridad.

## 9.6 Facturas rectificativas

Debe permitir:

- rectificación total;
- rectificación parcial;
- por diferencias;
- relación explícita con documento(s) original(es);
- serie específica cuando proceda;
- motivo;
- importes corregidos;
- registro fiscal corrector;
- asiento corrector.

## 9.7 Anticipos

Permitir:

- factura de anticipo;
- cobro;
- aplicación posterior a factura final;
- tratamiento fiscal separado;
- conciliación del anticipo.

## 9.8 Plantillas

Personalización:

- logo;
- tipografía;
- colores;
- datos bancarios;
- condiciones;
- textos legales;
- idioma;
- campos opcionales;
- pie.

---

# 10. Facturación recurrente

Configuración:

- frecuencia;
- próxima fecha;
- fecha fin;
- cliente;
- líneas;
- precios;
- impuestos;
- serie;
- método de pago;
- generar borrador o emitir;
- enviar automáticamente;
- reintentos;
- responsable.

Debe existir idempotencia para evitar generar dos facturas por la misma recurrencia.

---

# 11. Compras y gastos

## 11.1 Tipos

- factura proveedor;
- factura rectificativa recibida;
- ticket;
- gasto sin factura cuando legalmente proceda;
- nómina;
- pedido de compra;
- abono;
- activo;
- provisión/suplido en perfiles profesionales.

## 11.2 Entrada

- carga manual;
- drag & drop;
- email de recepción;
- API;
- importación;
- OCR.

## 11.3 OCR

Extraer como sugerencia:

- proveedor;
- NIF;
- número;
- fecha;
- base;
- tipos;
- cuotas;
- total;
- retenciones;
- vencimiento;
- IBAN si aparece.

La extracción nunca debe contabilizar automáticamente sin pasar validaciones.

## 11.4 Workflow de aprobación

```text
Recibida
→ OCR
→ Pendiente revisión
→ Aprobada
→ Contabilizada
→ Pendiente pago
→ Pagada
→ Conciliada
```

Configurable por importe, departamento, proyecto o proveedor.

---

# 12. IVA

## 12.1 Conceptos obligatorios

El motor debe diferenciar:

- sujeto;
- no sujeto;
- exento;
- tipo cero;
- inversión del sujeto pasivo;
- adquisición intracomunitaria;
- entrega intracomunitaria;
- importación;
- exportación;
- recargo de equivalencia;
- criterio de caja;
- prorrata;
- bienes de inversión;
- regímenes especiales añadidos por fases.

## 12.2 Tipos

Las reglas no se almacenarán solo como porcentaje. Cada regla incluirá:

- código;
- naturaleza;
- tipo;
- recargo;
- vigencia;
- referencia legal;
- derecho a deducción;
- clave de libro/modelo;
- condiciones.

## 12.3 IVA soportado vs deducible

El sistema deberá conservar:

- cuota soportada;
- porcentaje deducible;
- cuota deducible;
- motivo de deducibilidad parcial;
- prorrata aplicada;
- regularizaciones.

No se asumirá que toda cuota soportada es deducible.

## 12.4 Fechas

Separar:

- fecha de expedición;
- fecha de operación;
- fecha de devengo;
- fecha contable;
- periodo de deducción.

---

# 13. Retenciones e IRPF

## 13.1 Retenciones practicadas

Ejemplos:

- profesionales;
- trabajo;
- alquileres;
- otras rentas soportadas en fases posteriores.

Registrar:

- perceptor;
- tipo de renta;
- base;
- porcentaje;
- importe;
- fecha de devengo;
- modelo periódico;
- clave/subclave anual.

## 13.2 Retenciones soportadas

Para autónomos/profesionales:

- factura emitida;
- base;
- retención aplicada por cliente;
- importe pendiente/cobrado;
- acumulado fiscal.

No mezclar con retenciones que la empresa practica a terceros.

## 13.3 Libros IRPF

Para profesionales en estimación directa:

- ingresos;
- gastos;
- bienes de inversión;
- provisiones de fondos y suplidos.

Para empresarios, los libros dependerán de actividad y régimen.

---

# 14. Libros registro

## 14.1 Libros IVA

Generar, según proceda:

- facturas expedidas;
- facturas recibidas;
- bienes de inversión;
- determinadas operaciones intracomunitarias.

## 14.2 Compatibilidad AEAT

El sistema debe poder exportar conforme a los diseños normalizados aplicables del ejercicio.

Las reglas de exportación estarán versionadas.

## 14.3 Trazabilidad

Cada fila del libro debe permitir llegar a:

- documento;
- desglose fiscal;
- asiento;
- contraparte;
- registro SIF/SII si existe.

---

# 15. Modelos tributarios

## 15.1 P0

- 303;
- 111;
- 115;
- 130;
- 180;
- 190;
- 347;
- 349.

## 15.2 P1

- 390;
- 131;
- 123;
- 193;
- 216;
- 296;
- 202;
- 200.

## 15.3 Motor de declaraciones

Estados:

- borrador;
- calculada;
- revisada;
- presentada;
- sustituida/rectificada según mecanismo aplicable.

Al presentar o marcar como presentada:

- guardar snapshot;
- fecha;
- referencia;
- resultado;
- versión de reglas;
- usuario;
- adjuntos/justificante.

Una declaración presentada no debe cambiar por recalcular periodos posteriores.

---

# 16. Modelo 303

Debe derivarse del ledger fiscal.

Soportar, según versión anual:

- IVA devengado por tipos;
- inversión del sujeto pasivo;
- adquisiciones intracomunitarias;
- rectificaciones;
- recargo;
- IVA deducible;
- importaciones;
- prorrata;
- regularizaciones;
- compensaciones;
- resultado.

El sistema debe mostrar explicación de cada casilla:

```text
Casilla
→ regla de cálculo
→ registros incluidos
→ documentos origen
```

---

# 17. Modelos 111 y 190

## 17.1 111

Agregar por periodo:

- perceptores;
- bases/percepciones;
- retenciones/ingresos a cuenta;
- categorías aplicables.

## 17.2 190

Detalle anual por perceptor:

- NIF;
- nombre;
- clave;
- subclave;
- percepciones;
- retenciones;
- importes en especie cuando proceda.

Control:

```text
suma de retenciones periódicas
≈
resumen anual por perceptor
```

---

# 18. Modelos 115 y 180

## 18.1 115

- número de perceptores;
- base;
- retención de arrendamientos.

## 18.2 180

Desglose anual:

- arrendador;
- inmueble/datos exigibles;
- base;
- retención.

Debe reconciliar con los 115 del ejercicio.

---

# 19. Modelo 130

Para perfiles aplicables:

- cálculo acumulado desde inicio de ejercicio;
- ingresos computables;
- gastos deducibles;
- amortizaciones;
- retenciones soportadas;
- pagos fraccionados anteriores;
- especialidades parametrizadas.

No usar únicamente datos del trimestre aislado.

---

# 20. Modelos 347 y 349

## 20.1 347

- acumulación por tercero;
- desglose periódico requerido;
- clasificación de operaciones;
- exclusiones reglamentarias parametrizadas;
- operaciones en efectivo cuando proceda.

## 20.2 349

- VAT ID;
- país;
- clave de operación;
- adquisiciones/entregas/servicios intracomunitarios;
- rectificaciones;
- periodo.

---

# 21. Contabilidad

## 21.1 Estándares

- PGC;
- PGC-Pymes cuando proceda;
- libros IRPF para perfiles que no requieran contabilidad mercantil completa.

## 21.2 Funciones

- plan contable;
- diario;
- mayor;
- asientos manuales;
- asientos automáticos;
- conciliación;
- periodos;
- cierres;
- reversión;
- activos;
- amortización;
- centros de coste;
- analítica;
- balance;
- PyG;
- cuentas anuales según alcance.

## 21.3 Reglas automáticas

Ejemplos:

### Venta

```text
430 Cliente                    Debe
    700/705 Ingreso            Haber
    477 IVA repercutido        Haber
```

### Compra

```text
6xx Gasto                      Debe
472 IVA soportado              Debe
    400/410 Proveedor          Haber
```

### Profesional con retención

```text
623 Servicios                  Debe
472 IVA soportado              Debe
    410 Acreedor               Haber
    4751 Retenciones           Haber
```

## 21.4 Inmutabilidad

Un asiento contabilizado no se modifica. Se corrige mediante:

- reversión;
- contrasiento;
- asiento corrector.

---

# 22. Cierres

## 22.1 Cierre de periodo fiscal

Proceso:

1. detectar documentos pendientes;
2. validar libros;
3. revisar diferencias;
4. calcular modelo;
5. reconciliar con contabilidad;
6. revisión;
7. presentación/registro;
8. bloqueo.

## 22.2 Cierre contable

- bloqueo temporal;
- amortizaciones;
- periodificaciones;
- regularización;
- resultado;
- cierre;
- apertura;
- cuentas anuales.

## 22.3 Reapertura

Solo usuarios autorizados.

Debe registrar:

- motivo;
- usuario;
- fecha;
- periodo;
- acciones posteriores.

---

# 23. SIF / VERI*FACTU

## 23.1 Alcance funcional

El módulo debe soportar:

- registros de facturación;
- alta;
- anulación;
- encadenamiento/huella conforme a especificaciones;
- QR;
- remisión cuando se opere en modalidad VERI*FACTU;
- respuestas;
- errores;
- reintentos;
- trazabilidad;
- declaración responsable del productor por versión.

## 23.2 Modalidades

```text
SIF
├── VERI*FACTU
└── NO VERI*FACTU
```

La configuración dependerá del sujeto y del ámbito normativo aplicable.

## 23.3 Fechas de referencia

Conforme a la información AEAT vigente a septiembre de 2026, la adaptación obligatoria se sitúa en:

- 1 de enero de 2027 para contribuyentes del Impuesto sobre Sociedades;
- 1 de julio de 2027 para el resto de obligados comprendidos.

El sistema debe almacenar la base de configuración por sujeto y no inferir la obligación solo por fecha.

---

# 24. Factura electrónica B2B

Módulo desacoplado de la factura interna.

Modelo:

```text
Factura canónica
→ adaptador de formato
→ plataforma
→ estado de entrega
→ aceptación/rechazo
→ estado de pago
```

Preparar adaptadores para formatos exigidos/aplicables.

La entrada en vigor efectiva de obligaciones concretas debe resolverse mediante configuración normativa versionada, no mediante fechas hardcodeadas en la lógica de negocio.

---

# 25. Bancos y tesorería

## 25.1 Cuentas

- banco;
- IBAN;
- moneda;
- saldo;
- empresa;
- cuenta contable.

## 25.2 Importación

- Open Banking;
- CSV;
- Norma 43;
- otros formatos por adaptadores.

## 25.3 Conciliación

Sugerencias por:

- importe;
- fecha;
- referencia;
- contraparte;
- IBAN;
- número de factura;
- combinación de movimientos.

Estados:

- sin conciliar;
- sugerida;
- conciliada;
- parcialmente conciliada.

## 25.4 Regla

El movimiento bancario no determina por sí mismo el tratamiento fiscal.

---

# 26. Cobros y pagos

Soportar:

- pago completo;
- parcial;
- varios documentos;
- un documento con varios pagos;
- anticipos;
- devoluciones;
- diferencias;
- comisiones;
- pagos de impuestos;
- medios de pago.

---

# 27. Inventario

## 27.1 Funciones

- múltiples almacenes;
- stock físico;
- disponible;
- reservado;
- esperado;
- transferencias;
- ajustes;
- recuentos;
- devoluciones;
- alertas;
- coste.

## 27.2 Movimientos

- compra;
- venta;
- devolución;
- transferencia;
- ajuste;
- inventario;
- producción en fases posteriores.

## 27.3 Fases avanzadas

- lotes;
- series;
- caducidades;
- kits;
- BOM/fabricación;
- trazabilidad avanzada.

---

# 28. CRM

Entidades:

- pipeline;
- etapa;
- oportunidad;
- actividad;
- tarea;
- llamada;
- reunión;
- nota.

Flujo:

```text
Lead
→ Oportunidad
→ Presupuesto
→ Pedido
→ Factura
```

Funciones:

- Kanban;
- forecast;
- probabilidad;
- responsable;
- productos;
- actividades;
- documentos.

---

# 29. Proyectos

Entidades:

- proyecto;
- tarea;
- subtarea;
- miembro;
- hora;
- tarifa;
- coste;
- gasto;
- documento.

Vistas:

- lista;
- Kanban;
- calendario;
- timeline.

Rentabilidad:

```text
Ingresos
- horas
- compras
- gastos
= margen
```

Horas facturables convertibles en líneas de factura.

---

# 30. Recursos humanos

## 30.1 Ficha

- datos personales;
- datos laborales;
- equipo;
- responsable;
- centro;
- contrato;
- jornada;
- documentación.

## 30.2 Funciones

- ausencias;
- vacaciones;
- control horario;
- calendarios;
- documentos;
- gastos;
- nóminas en fases posteriores.

Los datos de RR. HH. tendrán permisos reforzados.

---

# 31. Portal de cliente

Funciones:

- acceso seguro;
- presupuestos;
- aceptación;
- facturas;
- pagos;
- documentos;
- actualización limitada de datos.

Seguridad:

- usuario/contraseña;
- magic link;
- enlaces firmados con caducidad;
- revocación.

---

# 32. TPV

PWA/tablet.

Funciones:

- catálogo;
- código de barras;
- carrito;
- descuentos;
- cliente;
- factura simplificada;
- cobro;
- devolución;
- caja;
- stock.

Debe integrarse con las mismas reglas de facturación y SIF que el resto del ERP.

---

# 33. Informes

## 33.1 Comerciales

- ventas;
- clientes;
- productos;
- recurrencia;
- vencidos.

## 33.2 Compras

- proveedor;
- categoría;
- evolución;
- vencimientos.

## 33.3 Tesorería

- saldos;
- cash flow;
- previsión;
- aging.

## 33.4 Contabilidad

- diario;
- mayor;
- sumas y saldos;
- balance;
- PyG;
- analítica.

## 33.5 Fiscalidad

- IVA;
- retenciones;
- libros;
- modelos;
- diferencias;
- histórico de presentaciones.

Exportación:

- CSV;
- XLSX;
- PDF donde proceda.

---

# 34. Integraciones

P0/P1:

- correo;
- bancos;
- pasarela de pago;
- almacenamiento;
- AEAT mediante módulos habilitados;
- API pública;
- webhooks.

P2:

- e-commerce;
- marketplaces;
- nómina;
- BI;
- gestorías;
- e-factura;
- servicios externos.

---

# 35. API y webhooks: requisitos funcionales

La API debe permitir como mínimo gestionar:

- empresas;
- contactos;
- productos;
- documentos;
- pagos;
- movimientos bancarios;
- proyectos;
- asientos;
- libros;
- modelos según permisos.

Webhooks:

- invoice.created;
- invoice.issued;
- invoice.paid;
- invoice.rectified;
- payment.created;
- bank_transaction.created;
- stock.changed;
- tax_return.reviewed;
- tax_return.filed.

---

# 36. Usuarios y permisos

Modelo de permisos granular:

```text
módulo.recurso.acción
```

Ejemplos:

```text
sales.invoice.create
sales.invoice.issue
sales.invoice.read

accounting.entry.post
accounting.entry.reverse

tax.return.calculate
tax.return.review
tax.return.file

banking.reconcile

hr.salary.read
```

Ámbitos:

- organización;
- empresa;
- equipo;
- proyecto;
- almacén.

---

# 37. Auditoría

Registrar:

- usuario;
- acción;
- entidad;
- antes/después;
- fecha;
- IP;
- agente;
- empresa.

Acciones de máxima sensibilidad:

- emisión;
- rectificación;
- contabilización;
- reversión;
- cambio fiscal;
- cierres;
- reaperturas;
- modelos;
- permisos;
- SIF.

---

# 38. Búsqueda global

Buscar por:

- cliente;
- NIF;
- proveedor;
- factura;
- pedido;
- producto;
- proyecto;
- movimiento;
- asiento.

Resultados respetan permisos y empresa.

---

# 39. Importación y migración

Wizard:

```text
Carga
→ detección
→ mapeo
→ validación
→ vista previa
→ importación
→ informe
```

Tipos:

- contactos;
- productos;
- facturas;
- gastos;
- asientos;
- bancos;
- stock.

Toda importación tendrá identificador y log de errores.

---

# 40. Notificaciones

Canales:

- aplicación;
- email;
- webhook;
- push en fases posteriores.

Eventos:

- vencimientos;
- aprobaciones;
- errores bancarios;
- errores SIF/SII;
- stock;
- tareas;
- impuestos.

Configurable por usuario.

---

# 41. Requisitos de UX

- responsive;
- navegación por teclado en procesos contables;
- formularios con autosave en borradores;
- filtros persistentes;
- acciones masivas;
- importación rápida;
- explicación de errores fiscales;
- drill-down desde informes hasta documento;
- modo asesoría para cambiar de empresa rápidamente;
- estados visibles y no ambiguos.

---

# 42. Requisitos de accesibilidad

Objetivo:

- WCAG 2.2 AA para superficies principales;
- navegación con teclado;
- labels y mensajes de error accesibles;
- contraste;
- foco visible;
- semántica correcta.

---

# 43. Requisitos no funcionales percibidos por producto

- disponibilidad objetivo >= 99,9 %;
- respuesta p95 de operaciones simples < 300 ms en backend, excluyendo terceros;
- búsqueda habitual < 1 s;
- generación de informes pesados asíncrona;
- trazabilidad de trabajos;
- exportación de datos;
- recuperación ante errores;
- soporte multiidioma.

---

# 44. Criterios de aceptación transversales

Un caso fiscal/contable se considera terminado solo cuando se prueba:

```text
Documento
→ cálculo económico
→ cálculo fiscal
→ ledger fiscal
→ asiento
→ libro
→ modelo
→ auditoría
```

Ejemplo profesional:

```text
Base: 1.000
IVA: 210
Retención: 150
Pago: 1.060
```

Debe producir coherentemente:

- factura/gasto;
- IVA soportado 210;
- retención practicada 150;
- deuda 1.060;
- asiento equilibrado;
- libro IVA;
- registro de retenciones;
- 303;
- 111;
- 190.

---

# 45. Reconciliaciones obligatorias

## 45.1 IVA

```text
Tax Ledger
↔ libros IVA
↔ modelo 303
↔ cuentas 472/477
```

## 45.2 Retenciones

```text
111 del ejercicio
↔ 190 anual
```

## 45.3 Arrendamientos

```text
115 del ejercicio
↔ 180 anual
```

## 45.4 Bancos

```text
movimiento
↔ pago/cobro
↔ documento
↔ cuenta contable
```

---

# 46. Alcance P0

Producto comercial inicial:

- multiempresa;
- usuarios/permisos;
- contactos;
- productos/servicios;
- presupuestos;
- pedidos básicos;
- facturas;
- rectificativas;
- recurrentes;
- compras/gastos;
- PDF/email;
- pagos/cobros;
- importación bancaria;
- conciliación;
- PGC/PGC-Pymes;
- diario/mayor;
- balance/PyG;
- IVA;
- retenciones;
- libros IVA/IRPF;
- 303;
- 111;
- 115;
- 130;
- 180;
- 190;
- 347;
- 349;
- periodos;
- auditoría;
- SIF/VERI*FACTU;
- API básica.

---

# 47. Alcance P1

- SII;
- inventario completo;
- multi-almacén;
- CRM;
- proyectos;
- portal cliente;
- activos;
- prorrata avanzada;
- bienes de inversión;
- criterio de caja;
- recargo de equivalencia;
- 390;
- 131;
- 123/193;
- 216/296;
- 200/202 básico;
- e-factura B2B según calendario aplicable.

---

# 48. Alcance P2

- IGIC;
- IPSI;
- forales;
- nómina completa;
- TPV avanzado;
- fabricación;
- REBU;
- agencias de viaje;
- agricultura;
- marketplace;
- automatizaciones;
- BI avanzado;
- app móvil nativa.

---

# 49. Fuera de alcance inicial

Salvo acuerdo expreso:

- consolidación contable de grupos;
- NIIF/IFRS completa;
- banca propia;
- presentación tributaria universal sin revisión humana;
- asesoramiento fiscal automatizado con garantías profesionales;
- contabilidad foral completa;
- nómina completa en P0;
- fabricación MRP en P0.

---

# 50. Indicadores de éxito del producto

- tiempo medio de emisión de factura;
- porcentaje de documentos contabilizados automáticamente;
- porcentaje de conciliación sugerida aceptada;
- tasa de error en OCR;
- diferencias entre libros y declaraciones;
- errores SIF;
- tiempo de cierre mensual;
- tasa de facturas vencidas;
- satisfacción de asesorías;
- tickets de soporte por 1.000 documentos.

---

# 51. Referencias normativas y técnicas de base

Fuentes oficiales que deben revisarse en cada release:

1. **Plan General de Contabilidad — RD 1514/2007**  
   https://www.boe.es/buscar/act.php?id=BOE-A-2007-19884

2. **PGC de PYMES — RD 1515/2007**  
   https://www.boe.es/buscar/act.php?id=BOE-A-2007-19966

3. **Reglamento de facturación — RD 1619/2012, texto consolidado**  
   https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696

4. **Reglamento SIF — RD 1007/2023**  
   https://www.boe.es/buscar/doc.php?id=BOE-A-2023-24840

5. **Especificaciones SIF — Orden HAC/1177/2024**  
   https://www.boe.es/buscar/act.php?id=BOE-A-2024-22138

6. **AEAT — FAQ SIF/VERI*FACTU**  
   https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes.html

7. **AEAT — Libros registro de IVA**  
   https://sede.agenciatributaria.gob.es/Sede/iva/libros-registro.html

8. **AEAT — Libros electrónicos IVA/IRPF 2026**  
   https://sede.agenciatributaria.gob.es/Sede/iva/facturacion-registro/libros-registro-iva/libro-registro-soporte-electronico.html

9. **AEAT — Modelo 303, ejercicio 2026**  
   https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/iva/modelo-303-iva-autoliquidacion_/instrucciones-2026/instrucciones-02-12-2t-4t-2026.html

10. **AEAT — Obligaciones registrales IRPF**  
    https://sede.agenciatributaria.gob.es/Sede/irpf/Obligaciones.html

11. **AEAT — Retenciones 2026**  
    https://sede.agenciatributaria.gob.es/Sede/Retenciones.shtml

12. **AEAT — SII**  
    https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G417.shtml

13. **Factura electrónica B2B — RD 238/2026**  
    https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-7295

---

# 52. Cierre

El producto no debe concebirse como una aplicación de generación de facturas, sino como un sistema integrado donde cada hecho económico se transforma de forma trazable en:

```text
Gestión
→ documento
→ fiscalidad
→ contabilidad
→ tesorería
→ reporting
```

Ese principio debe mantenerse en todas las fases del producto.
