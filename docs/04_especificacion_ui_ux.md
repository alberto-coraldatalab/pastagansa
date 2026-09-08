# Especificación UI/UX completa
## ERP SaaS tipo Holded — Dirección visual “Fintech editorial lima”

**Versión:** 1.0  
**Estado:** Especificación de diseño para producto, UX, UI, frontend y QA  
**Producto:** ERP SaaS de facturación, contabilidad, fiscalidad y gestión para España  
**Dirección estética elegida:** Propuesta 1 — Fintech editorial  
**Paleta principal:** Lima  
**Idioma base de interfaz:** Español  
**Objetivo de accesibilidad:** WCAG 2.2 AA

---

# 1. Visión de diseño

El producto debe transmitir simultáneamente:

- confianza financiera;
- claridad;
- precisión;
- modernidad;
- velocidad;
- serenidad;
- profesionalidad.

La interfaz debe sentirse más cercana a un producto fintech premium que a un ERP tradicional.

No se busca una estética “corporativa pesada”, ni una interfaz excesivamente colorida.

La personalidad visual será:

```text
Limpia
Premium
Editorial
Precisa
Ligera
Confiable
Eficiente
```

El color lima aportará identidad y frescura, pero nunca deberá reducir legibilidad ni convertir el producto en una interfaz lúdica.

---

# 2. Principios UX

## 2.1 Claridad antes que decoración

Todo elemento visual debe tener función.

Evitar:

- adornos innecesarios;
- bordes excesivos;
- degradados decorativos;
- iconografía redundante;
- demasiados colores simultáneos;
- tarjetas para todo.

---

## 2.2 Densidad adaptable

El ERP tendrá dos niveles de densidad:

### Densidad cómoda

Por defecto para:

- dashboard;
- ventas;
- clientes;
- CRM;
- proyectos;
- portal.

### Densidad compacta

Para:

- contabilidad;
- bancos;
- impuestos;
- inventario;
- asesorías.

El usuario podrá elegir:

```text
Cómoda
Compacta
```

por módulo o globalmente.

---

## 2.3 El contexto nunca se pierde

Siempre debe quedar claro:

- empresa activa;
- ejercicio;
- módulo;
- documento;
- estado;
- periodo;
- filtros aplicados.

---

## 2.4 La fiscalidad debe ser explicable

Nunca mostrar únicamente:

```text
IVA: 2.340 €
```

Debe poder profundizarse:

```text
IVA
→ desglose
→ libro
→ documentos
→ asiento
```

---

## 2.5 Las acciones críticas deben ser explícitas

Diferenciar claramente:

```text
Guardar borrador
Emitir
Contabilizar
Presentar
Conciliar
Cerrar periodo
```

Estas acciones no son equivalentes.

---

## 2.6 Minimizar navegación innecesaria

Priorizar:

- drawers;
- panels;
- edición inline;
- command palette;
- quick actions;
- breadcrumbs;
- enlaces contextuales.

---

# 3. Identidad visual

## 3.1 Color principal

Color de marca:

```text
Lime 600
#65A30D
```

Debe ser suficientemente oscuro para acciones principales y estados activos.

---

# 4. Paleta de color

## 4.1 Lima

```text
Lime 50   #F7FEE7
Lime 100  #ECFCCB
Lime 200  #D9F99D
Lime 300  #BEF264
Lime 400  #A3E635
Lime 500  #84CC16
Lime 600  #65A30D
Lime 700  #4D7C0F
Lime 800  #3F6212
Lime 900  #365314
Lime 950  #1A2E05
```

### Uso

```text
Lime 50
→ backgrounds seleccionados

Lime 100
→ badges suaves

Lime 500
→ gráficos secundarios

Lime 600
→ CTA primario

Lime 700
→ hover CTA

Lime 900
→ textos especiales sobre fondo claro
```

No usar Lime 300/400 para texto sobre blanco.

---

# 5. Neutros

Dirección:

gris frío ligeramente azulado.

```text
Slate 25   #FCFCFD
Slate 50   #F8FAFC
Slate 100  #F1F5F9
Slate 200  #E2E8F0
Slate 300  #CBD5E1
Slate 400  #94A3B8
Slate 500  #64748B
Slate 600  #475569
Slate 700  #334155
Slate 800  #1E293B
Slate 900  #0F172A
Slate 950  #020617
```

---

# 6. Colores semánticos

## Success

```text
Green 600
#16A34A
```

## Warning

```text
Amber 600
#D97706
```

## Error

```text
Red 600
#DC2626
```

## Info

```text
Blue 600
#2563EB
```

Regla:

El lima representa:

```text
marca
acción
selección
progreso positivo
```

El verde representa:

```text
éxito
cobrado
conciliado
correcto
```

No mezclar ambos significados.

---

# 7. Fondo

## Aplicación

```text
#F8FAFC
```

## Superficie principal

```text
#FFFFFF
```

## Superficie secundaria

```text
#F8FAFC
```

## Superficie seleccionada

```text
#F7FEE7
```

---

# 8. Dark mode

No es requisito P0.

Debe quedar soportado por tokens desde el inicio.

Prioridad:

```text
P1
```

No diseñar colores hardcodeados.

---

# 9. Tipografía

## 9.1 Fuente UI recomendada

Preferencias:

```text
Inter
Geist
SF Pro
system-ui
```

Recomendación principal:

```text
Inter
```

Razones:

- alta legibilidad;
- números claros;
- buena densidad;
- excelente soporte tablas.

---

# 10. Escala tipográfica

```text
Display
32 / 40 / 700

H1
28 / 36 / 700

H2
22 / 30 / 650

H3
18 / 26 / 650

Body L
16 / 24 / 400

Body
14 / 21 / 400

Body S
13 / 19 / 400

Label
12 / 16 / 600

Caption
11 / 16 / 500
```

---

# 11. Números

Números financieros:

- `font-variant-numeric: tabular-nums`;
- alineación derecha;
- no usar fuente monoespaciada salvo casos técnicos.

Ejemplo:

```text
12.430,00 €
```

Nunca:

```text
12430€
```

---

# 12. Espaciado

Sistema base:

```text
4 px
```

Escala:

```text
4
8
12
16
20
24
32
40
48
64
```

---

# 13. Radios

```text
XS    4 px
S     6 px
M     8 px
L     12 px
XL    16 px
```

Recomendación:

- inputs: 8 px;
- botones: 8 px;
- cards: 12 px;
- modales: 16 px.

Evitar estética excesivamente redondeada.

---

# 14. Sombras

Muy discretas.

```text
Shadow XS
0 1px 2px rgba(15,23,42,.05)

Shadow S
0 2px 8px rgba(15,23,42,.06)

Shadow M
0 12px 30px rgba(15,23,42,.10)
```

Cards normales preferentemente:

```text
border + shadow XS
```

---

# 15. Bordes

```text
Default
#E2E8F0

Strong
#CBD5E1

Focus
#84CC16
```

---

# 16. Grid

Desktop:

```text
12 columnas
```

Gutter:

```text
24 px
```

Contenido:

```text
max-width: 1600 px
```

Las superficies contables pueden ocupar 100 % del viewport.

---

# 17. Breakpoints

```text
Mobile
< 640

Tablet
640–1023

Desktop
1024–1439

Wide
>= 1440
```

---

# 18. Shell principal

Estructura:

```text
┌──────────────┬────────────────────────────────────────────┐
│ Sidebar      │ Topbar                                     │
│              ├────────────────────────────────────────────┤
│              │                                            │
│              │ Main content                               │
│              │                                            │
└──────────────┴────────────────────────────────────────────┘
```

---

# 19. Sidebar

## Desktop

Ancho:

```text
232 px
```

Modo colapsado:

```text
64 px
```

Contenido:

```text
Logo
Empresa activa

Inicio

Ventas
Compras
Bancos
Contabilidad
Impuestos

Clientes
Proveedores
Productos

CRM
Proyectos
Inventario
RR. HH.

Informes

Configuración
```

Los módulos no contratados pueden:

- ocultarse;
- mostrarse como disponibles para activar según estrategia comercial.

---

# 20. Navegación por rol

La navegación se adapta.

## Comercial

```text
Inicio
CRM
Ventas
Clientes
Productos
```

## Contable

```text
Inicio
Ventas
Compras
Bancos
Contabilidad
Impuestos
Informes
```

## Asesor

```text
Empresas
Pendientes
Contabilidad
Impuestos
Cierres
Informes
```

---

# 21. Empresa activa

Visible siempre.

Selector:

```text
ACME Consulting S.L.
⌄
```

Al abrir:

- empresas recientes;
- búsqueda;
- cambiar empresa;
- crear empresa si permiso.

Debe mostrar NIF como información secundaria cuando existan nombres similares.

---

# 22. Topbar

Elementos:

```text
Breadcrumb
Search
Quick create
Notifications
Help
User
```

En módulos complejos:

```text
Breadcrumb
Page title
Status
Primary action
```

---

# 23. Búsqueda global

Shortcut:

```text
⌘ K
Ctrl K
```

Busca:

- clientes;
- proveedores;
- facturas;
- pedidos;
- productos;
- proyectos;
- movimientos;
- asientos.

Resultado:

```text
Facturas
FV-2026-0042
ACME Consulting
1.272 €
```

---

# 24. Command palette

Permitir acciones:

```text
Crear factura
Crear gasto
Crear contacto
Ir a bancos
Ir a modelo 303
Cambiar empresa
```

Usuarios avanzados deben poder operar con teclado.

---

# 25. Breadcrumbs

Ejemplo:

```text
Ventas
/
Facturas
/
FV-2026-0042
```

Evitar breadcrumbs demasiado largos.

---

# 26. Page header

Composición:

```text
Título
Descripción opcional
Estado
Acciones secundarias
CTA principal
```

Ejemplo:

```text
Factura FV-2026-0042          [Borrador]

[Más acciones] [Guardar] [Emitir factura]
```

---

# 27. Dashboard

Objetivo:

En menos de 10 segundos responder:

```text
¿Cómo va mi negocio?
¿Qué necesita mi atención?
```

---

# 28. Dashboard layout

Fila 1:

```text
Ingresos
Gastos
Resultado
IVA
```

Fila 2:

```text
Evolución
Facturas pendientes
Cobros y pagos
```

Fila 3:

```text
Alertas
Actividad
Tareas
```

---

# 29. KPI cards

Contenido:

```text
Ingresos
24.320 €
↑ 12 %
vs periodo anterior
```

Reglas:

- máximo 4 KPI principales;
- máximo 1 métrica primaria;
- tendencia pequeña;
- sparkline opcional.

---

# 30. Charts

Estilo:

- minimalista;
- sin bordes pesados;
- grid muy tenue;
- eje con pocos ticks;
- tooltip claro.

Paleta:

```text
Lima
Slate
Blue
Amber
Red
```

No usar arcoíris.

---

# 31. Listados

Estructura:

```text
Page header

Toolbar
Search
Filters
Saved views
Bulk actions

Table

Pagination
```

---

# 32. Tabla estándar

Altura:

```text
Cómoda: 48 px
Compacta: 36 px
```

Elementos:

- header fijo;
- selección;
- sorting;
- resize opcional;
- show/hide columns;
- filtros;
- export;
- sticky first column opcional.

---

# 33. Columnas financieras

Siempre:

```text
Importe
IVA
Total
Saldo
```

alineadas a derecha.

---

# 34. Estados en tabla

Badges:

```text
Borrador
Emitida
Cobrada
Vencida
Rectificada
```

Formato:

```text
icon + label
```

No depender solo del color.

---

# 35. Filtros

Tipos:

- texto;
- fecha;
- periodo;
- importe;
- estado;
- cliente;
- etiqueta;
- responsable;
- impuesto.

---

# 36. Saved views

Ejemplo:

```text
Mis facturas pendientes
Vencidas
Este trimestre
Grandes clientes
```

Permitir guardar:

- filtros;
- columnas;
- orden;
- densidad.

---

# 37. Empty states

Ejemplo:

```text
Todavía no tienes facturas

Crea tu primera factura y comienza a llevar
ventas, cobros y contabilidad desde aquí.

[Crear factura]
```

No utilizar ilustraciones grandes en módulos profesionales.

---

# 38. Loading

Preferir:

- skeletons;
- progressive loading.

Evitar spinner global salvo acciones breves.

---

# 39. Error states

Deben explicar:

```text
qué ocurrió
por qué
qué puede hacer el usuario
```

Ejemplo:

```text
No pudimos sincronizar tu banco

La conexión necesita renovarse.

[Reconectar banco]
```

---

# 40. Botones

## Primary

```text
background Lime 600
text white
```

Hover:

```text
Lime 700
```

## Secondary

```text
white
border Slate 200
text Slate 700
```

## Tertiary

text button.

## Destructive

Red.

---

# 41. Jerarquía de acciones

Máximo un CTA principal visual por región.

Ejemplo:

```text
[Guardar borrador] [Emitir factura]
```

`Emitir factura` es primary.

---

# 42. Inputs

Altura:

```text
40 px
```

Estados:

- default;
- hover;
- focus;
- error;
- disabled;
- readonly.

Focus:

```text
2 px Lime 500
```

---

# 43. Labels

Siempre visibles salvo controles claramente autodescriptivos.

No usar placeholder como label.

---

# 44. Validación

Inline.

Ejemplo:

```text
NIF
B1234567
──────────
El formato del NIF no es válido.
```

No esperar al submit si el error puede detectarse antes.

---

# 45. Formularios largos

Agrupar:

```text
Datos básicos
Facturación
Fiscalidad
Contabilidad
Pagos
Otros
```

Usar secciones plegables solo cuando sea útil.

---

# 46. Drawers

Anchuras:

```text
Small   400 px
Medium  560 px
Large   720 px
```

Usos:

- contacto;
- detalle factura;
- conciliación;
- preview;
- actividad.

---

# 47. Modales

Solo para:

- confirmación;
- acciones cortas;
- decisión crítica.

No meter formularios complejos en modales.

---

# 48. Confirmaciones

Solo para acciones realmente críticas.

Ejemplo emisión:

```text
Emitir factura

Se asignará un número definitivo y el documento
dejará de ser editable.

[Cancelar] [Emitir]
```

---

# 49. Toasts

Ejemplo:

```text
✓ Factura emitida correctamente
```

No usar toast como única evidencia para procesos largos.

---

# 50. Invoice editor

Es una de las pantallas más importantes.

Objetivo:

```text
crear factura estándar < 60 segundos
```

---

# 51. Layout factura

```text
Header

Cliente                  Documento
──────────────────────────────────

Líneas

──────────────────────────────────
Notas                Resumen fiscal
                     Total
```

---

# 52. Wireframe factura

```text
┌─────────────────────────────────────────────────────────────┐
│ Nueva factura                                               │
│ Crea y envía una factura a tu cliente.                      │
│                          [Guardar borrador] [Emitir factura] │
├─────────────────────────────────────────────────────────────┤
│ Cliente                     Fecha emisión     Nº factura     │
│ [ACME Consulting        ]   [08/09/2026]     [Automático]   │
│                                                             │
│ Dirección                   NIF               Moneda         │
│ Calle Mayor...              B12345678         EUR            │
├─────────────────────────────────────────────────────────────┤
│ Producto / servicio   Cant.  Precio  Dto. IVA       Total  │
│ Consultoría           2      500     0    21 %      1.000  │
│ Soporte               1      200     0    21 %        200  │
│                                                             │
│ + Añadir línea                                              │
├─────────────────────────────────────────────────────────────┤
│ Notas                      Base             1.200,00 €       │
│                            IVA 21 %            252,00 €      │
│                            IRPF 15 %          -180,00 €      │
│                            ─────────────────────────────      │
│                            TOTAL            1.272,00 €       │
└─────────────────────────────────────────────────────────────┘
```

---

# 53. Edición de líneas

Debe permitir teclado.

Shortcuts:

```text
Enter
→ siguiente celda

Shift + Enter
→ anterior

Ctrl/Cmd + Enter
→ nueva línea

Backspace
→ eliminar línea vacía
```

---

# 54. Selector de producto

Buscar por:

- nombre;
- SKU;
- EAN.

Mostrar:

```text
Consultoría estratégica
Servicio
500 €/ud
IVA 21 %
```

---

# 55. Tax selector

Default:

```text
21 %
```

pero tooltip/advanced muestra:

```text
IVA general — ES_VAT_21
```

Operaciones especiales aparecen como opciones explícitas.

---

# 56. Fiscal details

Panel “Detalles fiscales”.

Campos:

- sujeto/exento;
- inversión;
- país;
- intracomunitaria;
- retención;
- fecha operación;
- régimen especial.

No saturar flujo estándar.

---

# 57. Invoice preview

Split preview opcional:

```text
Editor
│
│
Preview PDF
```

Desktop wide.

---

# 58. Factura emitida

Header:

```text
FV-2026-0042
Emitida

[Enviar] [Registrar cobro] [Más]
```

Tabs:

```text
Resumen
Pagos
Contabilidad
Fiscalidad
Historial
```

---

# 59. Invoice drilldown

## Contabilidad

Mostrar asiento.

## Fiscalidad

Mostrar:

- ledger;
- IVA;
- retenciones;
- libro;
- SIF.

## Historial

Mostrar audit trail.

---

# 60. Compras y gastos

Pantalla lista similar a ventas.

Acción primaria:

```text
Nuevo gasto
```

Acciones rápidas:

```text
Subir factura
Importar
```

---

# 61. OCR review

Split view:

```text
Documento escaneado
│
Campos detectados
```

Los campos con baja confianza usan:

```text
Amber
```

Ejemplo:

```text
Proveedor
ACME SL
Confianza 98 %

Número factura
F2026/003
Confianza 61 %
[Revisar]
```

---

# 62. Expense approval

Mostrar:

```text
Importe
Proveedor
Fecha
Proyecto
Categoría
Cuenta
IVA
```

Acciones:

```text
Rechazar
Aprobar
```

---

# 63. Conciliación bancaria

Debe sentirse como una bandeja de trabajo.

---

# 64. Layout conciliación

```text
Movimientos
│
Detalle + sugerencias
```

En desktop wide.

En desktop normal:

lista + drawer.

---

# 65. Bank transaction card

```text
-1.060,00 €
ACME CONSULTING

08/09/2026
Transferencia SEPA

Estado
Por conciliar
```

---

# 66. Suggestions

```text
98 %
Factura proveedor F-8231
1.060,00 €

[Conciliar]
```

Otros:

```text
72 %
Factura F-8198
1.042,00 €

[Revisar]
```

---

# 67. Confidence visual

```text
90–100 %
Green

70–89 %
Lime / Amber según contexto

< 70 %
Slate / warning
```

No ocultar score.

---

# 68. Conciliación masiva

Acciones:

```text
Seleccionar sugerencias > 95 %
Conciliar seleccionadas
```

Debe mostrar count e importe total.

---

# 69. Contabilidad

La UX contable tiene máxima densidad.

Layout:

```text
Sidebar
Topbar
Toolbar
Full-width table
```

---

# 70. Diario

Columnas:

```text
Fecha
Asiento
Cuenta
Concepto
Documento
Debe
Haber
Centro
```

---

# 71. Accounting split view

Al seleccionar asiento:

```text
Table
│
Drawer
```

Drawer muestra:

- líneas;
- origen;
- documento;
- auditoría.

---

# 72. Asiento manual

Grid editable tipo spreadsheet.

Shortcuts:

```text
Tab
Shift Tab
Enter
Ctrl/Cmd + Enter
Ctrl/Cmd + S
```

Autocompletar cuentas.

---

# 73. Accounting validation

Footer:

```text
Debe
1.210 €

Haber
1.210 €

✓ Cuadrado
```

Si no:

```text
Diferencia
150 €
```

en error.

---

# 74. Period lock

Si cerrado:

```text
Periodo cerrado

No puedes contabilizar en este periodo.

[Ver cierre]
```

Nunca fallar únicamente con error técnico.

---

# 75. Impuestos

La navegación fiscal debe ser especialmente clara.

Home:

```text
Resumen
IVA
Retenciones
IRPF
Modelos
Libros
Configuración
```

---

# 76. Tax dashboard

Cards:

```text
Próximo modelo
303 — 3T 2026

IVA devengado
IVA deducible

Retenciones

Alertas
```

---

# 77. Modelo fiscal

Ejemplo:

```text
Modelo 303
3T 2026

Estado
Borrador

Resultado
2.340 €
```

Acciones:

```text
Recalcular
Revisar
Marcar presentado
```

---

# 78. Form layout

Izquierda:

```text
Secciones
```

Centro:

```text
Casillas
```

Derecha:

```text
Explicación / documentación
```

---

# 79. Explainability

Al hacer click:

```text
Casilla 28
IVA deducible en operaciones interiores

2.430,00 €

37 registros
```

Acciones:

```text
Ver registros
Ver documentos
Exportar
```

---

# 80. Tax records drawer

Tabla:

```text
Fecha
Documento
Proveedor
Base
IVA
Deducible
```

Click abre documento.

---

# 81. Reconciliation warning

Ejemplo:

```text
⚠ Existe una diferencia de 210,00 €

Libro IVA
8.430 €

Contabilidad
8.220 €

[Investigar]
```

---

# 82. Cierre fiscal

Wizard:

```text
1 Documentos
2 Libros
3 Reconciliación
4 Modelo
5 Revisión
6 Bloqueo
```

Mostrar progreso.

---

# 83. SIF/VERI*FACTU UI

Detalle factura:

```text
Registro fiscal
✓ Generado

Huella
...

Estado AEAT
Aceptado
```

---

# 84. SIF error

Ejemplo:

```text
Remisión pendiente

La AEAT no está disponible temporalmente.
No necesitas volver a emitir la factura.

Reintentaremos automáticamente.

[Ver detalle]
```

---

# 85. CRM

Dirección visual ligeramente más cálida.

Pipeline:

```text
Kanban
```

Cards:

- empresa;
- oportunidad;
- valor;
- fecha;
- owner.

Lima solo para:

- selección;
- progreso;
- CTA.

---

# 86. Projects

Vistas:

- lista;
- Kanban;
- calendario;
- timeline.

Project header:

```text
Proyecto Alpha

Estado
En curso

Ingresos
25.000

Coste
14.000

Margen
11.000
```

---

# 87. Inventory

Tabla compacta:

```text
Producto
SKU
Disponible
Reservado
Entrante
Almacén
```

Alertas de stock:

badge amber/red.

---

# 88. HR

Visualmente más cálido pero coherente.

Ficha empleado:

```text
Resumen
Contrato
Ausencias
Horas
Documentos
```

Datos sensibles con permisos.

---

# 89. Portal cliente

Simplificar navegación.

```text
Inicio
Presupuestos
Facturas
Pagos
Documentos
```

Más espacio blanco.

No mostrar terminología contable innecesaria.

---

# 90. TPV

Diseño touch-first.

Layout:

```text
Productos
│
Carrito
```

Botones grandes.

Mínimo touch target:

```text
44 × 44 px
```

---

# 91. Onboarding

Objetivo:

primera factura en menos de 10 minutos para usuario simple.

Wizard:

```text
1 Tu empresa
2 Facturación
3 Impuestos
4 Banco opcional
5 Primera factura
```

---

# 92. Progressive disclosure

No mostrar toda configuración fiscal al usuario estándar.

Modo:

```text
Básico
Avanzado
```

Ejemplo:

Básico:

```text
IVA
21 %
```

Avanzado:

```text
Código fiscal
ES_VAT_21
Cuenta contable
477...
```

---

# 93. Help

Contextual.

Icono:

```text
?
```

Tooltip corto.

Enlace:

```text
Más información
```

No usar tooltips para información crítica.

---

# 94. Notifications

Centro:

```text
Facturas
Bancos
Impuestos
Sistema
```

Prioridades:

```text
Info
Action
Warning
Critical
```

---

# 95. Notification examples

```text
5 movimientos esperan conciliación
```

```text
El modelo 303 está listo para revisar
```

```text
La conexión bancaria caduca en 3 días
```

---

# 96. Accessibility

Objetivo:

```text
WCAG 2.2 AA
```

---

# 97. Contraste

Todos los textos y componentes deben cumplir ratios aplicables.

El lima claro no se usa para texto sobre blanco.

---

# 98. Keyboard

Todo flujo principal usable con teclado.

Focus visible.

No traps.

---

# 99. Screen readers

Usar:

- labels;
- roles;
- aria;
- live regions para estados.

Tablas con headers correctos.

---

# 100. Touch targets

Mínimo:

```text
44 × 44
```

en mobile/touch.

---

# 101. Motion

Duración:

```text
120–200 ms
```

Usos:

- hover;
- drawer;
- menu;
- toast.

No animar números financieros de manera distractora.

Respetar:

```text
prefers-reduced-motion
```

---

# 102. Responsive

## Desktop

Experiencia principal.

## Tablet

Sidebar colapsable.

Drawers fullscreen cuando necesario.

## Mobile

Priorizar:

- consultar;
- aprobar;
- emitir simple;
- registrar gasto;
- notificaciones.

Contabilidad avanzada puede requerir desktop.

---

# 103. Mobile navigation

Bottom navigation opcional:

```text
Inicio
Ventas
Gastos
Más
```

Para roles simples.

---

# 104. Content design

Tono:

- profesional;
- claro;
- directo;
- humano.

Evitar:

```text
Se ha producido una excepción
```

Preferir:

```text
No pudimos guardar el gasto.
```

---

# 105. Terminología

Usar términos españoles consistentes:

```text
Factura
Proveedor
Cliente
IVA
Retención
Asiento
Debe
Haber
Conciliar
```

No mezclar:

```text
invoice
bill
journal
```

en UI española.

---

# 106. Microcopy

CTA:

```text
Emitir factura
```

mejor que:

```text
Confirmar
```

Porque describe consecuencia.

---

# 107. Destructive copy

Ejemplo:

```text
Eliminar borrador
```

No:

```text
Eliminar
```

sin contexto.

---

# 108. Estado documental

Sistema estándar:

```text
Draft
Issued
Paid
Overdue
Rectified
```

UI:

```text
Borrador
Emitida
Cobrada
Vencida
Rectificada
```

---

# 109. Iconografía

Estilo:

- outline;
- 1.5–2 px;
- simple;
- consistente.

Tamaño:

```text
16
18
20
24
```

---

# 110. Logos y marca

Sidebar:

logo compacto.

Login:

logo completo.

No usar logo repetido en superficies internas.

---

# 111. Ilustración

Muy limitada.

Permitida:

- onboarding;
- empty states principales;
- marketing.

Evitar en:

- contabilidad;
- impuestos;
- bancos.

---

# 112. Data visualization

Principios:

- escala honesta;
- leyendas claras;
- tooltips;
- evitar 3D;
- evitar donut salvo proporciones simples;
- línea para evolución;
- barras para comparaciones;
- tablas para precisión.

---

# 113. Semantic color in charts

Ejemplo:

```text
Ingresos → Lima
Gastos → Slate
Warning → Amber
Negative → Red
```

No usar rojo para cualquier descenso si descenso puede ser positivo.

---

# 114. Date formats

Español:

```text
08/09/2026
```

Formato extendido:

```text
8 sep 2026
```

---

# 115. Currency formats

España:

```text
1.272,00 €
```

Configurable por locale.

---

# 116. Percent

```text
21 %
```

Consistencia visual.

---

# 117. Tax identification

Mostrar:

```text
B12345678
```

sin formateo innecesario.

---

# 118. Status language

Evitar jerga técnica.

Interno:

```text
SIF_SUBMISSION_PENDING
```

UI:

```text
Pendiente de envío
```

---

# 119. Design tokens

Ejemplo CSS:

```css
:root {
  --color-brand-50: #F7FEE7;
  --color-brand-100: #ECFCCB;
  --color-brand-500: #84CC16;
  --color-brand-600: #65A30D;
  --color-brand-700: #4D7C0F;

  --color-text-primary: #0F172A;
  --color-text-secondary: #475569;
  --color-text-muted: #64748B;

  --color-border: #E2E8F0;
  --color-background: #F8FAFC;
  --color-surface: #FFFFFF;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

---

# 120. Component library

P0:

```text
Button
IconButton
Input
Textarea
Select
Combobox
Checkbox
Radio
Switch
DatePicker
MoneyInput
PercentageInput
TaxSelect
Badge
StatusBadge
Tooltip
Popover
Dropdown
Modal
Drawer
Tabs
Breadcrumb
Table
DataGrid
Pagination
Card
KPI
Alert
Toast
Skeleton
EmptyState
Search
CommandPalette
FileUpload
Avatar
Stepper
Timeline
```

---

# 121. Domain components

Crear componentes específicos:

```text
Money
TaxBadge
InvoiceStatus
AccountingBalance
ReconciliationScore
TaxFormBox
FiscalStatus
SifStatus
DocumentNumber
PeriodSelector
CompanySwitcher
```

No reconstruirlos manualmente en cada página.

---

# 122. Storybook

Todos los componentes deberán documentarse.

Estados:

- default;
- hover;
- focus;
- disabled;
- loading;
- error;
- empty.

---

# 123. Figma structure

Proyecto:

```text
00 Foundations
01 Components
02 Patterns
03 Shell
04 Dashboard
05 Sales
06 Purchases
07 Banking
08 Accounting
09 Tax
10 CRM
11 Projects
12 Inventory
13 HR
14 Portal
15 Mobile
16 Prototype
```

---

# 124. Naming Figma

Formato:

```text
Component / Variant / State
```

Ejemplo:

```text
Button / Primary / Default
```

---

# 125. Handoff

Cada pantalla debe indicar:

- breakpoint;
- spacing;
- token;
- states;
- interaction;
- validation;
- loading;
- permissions.

---

# 126. Design QA

Checklist:

```text
spacing
tokens
contrast
font
responsive
states
keyboard
empty
error
loading
permissions
```

---

# 127. UX QA

Validar:

- flujo;
- terminología;
- cantidad de clicks;
- orientación;
- recoverability;
- feedback.

---

# 128. Performance UX

Evitar layouts que dependan de cargar todo.

Pantalla debe ser útil progresivamente.

---

# 129. Optimistic UI

Permitida:

- etiquetas;
- notas;
- preferencias.

No utilizar optimistic UI para:

- emisión;
- contabilidad;
- presentación fiscal;
- conciliación irreversible.

---

# 130. Unsaved changes

En borradores con autosave:

```text
Guardado
```

Estado sutil.

Si falla:

```text
No se pudo guardar
[Reintentar]
```

---

# 131. Audit UX

Historial:

```text
08 sep · 10:22
Laura emitió la factura

08 sep · 10:24
Sistema generó el asiento 482
```

Legible para humanos.

---

# 132. Role-aware dashboard

## Owner

- ingresos;
- gastos;
- cash;
- impuestos.

## Accountant

- pendientes;
- bancos;
- diferencias;
- cierres.

## Sales

- pipeline;
- ventas;
- pendientes.

---

# 133. Advisor mode

Header especial:

```text
Modo asesoría
```

Empresa switcher optimizado.

Vista home:

```text
Empresa
Estado IVA
Banco pendiente
Documentos
Alertas
```

---

# 134. Advisor company list

Columnas:

```text
Empresa
Periodo
303
111
Banco
Pendientes
Última actividad
```

Color solo para excepciones.

---

# 135. Security UX

Acciones críticas requieren:

- identidad clara;
- resultado claro;
- confirmación contextual.

No pedir contraseña repetidamente salvo alta sensibilidad.

---

# 136. MFA

Flujo simple:

```text
Escanea QR
Introduce código
Guarda códigos recuperación
```

---

# 137. Sessions

Configuración:

```text
Dispositivos activos
Madrid · Chrome
Ahora

[Revocar]
```

---

# 138. Privacy UX

Permitir:

- exportar;
- gestionar datos;
- solicitudes.

No mezclar eliminación con conservación fiscal.

---

# 139. Import UX

Wizard:

```text
1 Archivo
2 Columnas
3 Validación
4 Vista previa
5 Importar
6 Resultado
```

---

# 140. Import validation

Resumen:

```text
1.240 válidos
18 avisos
4 errores
```

Permitir descargar errores.

---

# 141. Export UX

Exportar:

```text
Vista actual
Todos
Seleccionados
```

Formato:

```text
CSV
XLSX
PDF
```

según módulo.

---

# 142. Bulk actions

Bar contextual:

```text
12 seleccionadas

[Marcar] [Exportar] [Más]
```

No mostrar acciones masivas no aplicables.

---

# 143. Notification center

Agrupar por fecha.

Permitir:

```text
Marcar leído
Ir a elemento
```

---

# 144. Activity feed

Usar para:

- CRM;
- proyecto;
- contacto.

No sustituir auditoría fiscal.

---

# 145. Keyboard shortcuts globales

```text
Ctrl/Cmd K
Buscar

C + F
Nueva factura

C + G
Nuevo gasto

G + B
Bancos

G + C
Contabilidad
```

Atajos configurables P1.

---

# 146. Help shortcuts

```text
?
```

abre panel de shortcuts.

---

# 147. Print

Factura:

- diseño optimizado A4.

Contabilidad:

- export/PDF.

UI no necesita ser imprimible entera.

---

# 148. Localization

Base:

```text
es-ES
```

Preparar:

```text
en
ca
pt
fr
```

No hardcodear texto en componentes.

---

# 149. Error taxonomy

## Validation

Usuario puede corregir.

## Permission

Explicar restricción.

## External

Proveedor/AEAT/banco.

## System

Error interno.

Cada tipo tiene copy y acción distinta.

---

# 150. External outage

Ejemplo:

```text
La AEAT no responde ahora mismo

Tu factura está emitida correctamente.
La remisión fiscal queda pendiente.

[Ver estado]
```

---

# 151. Confirmation patterns

## Low risk

No confirmation.

## Medium

Undo toast.

## High

Modal.

## Fiscal irreversible

Modal + explicación clara.

---

# 152. Undo

Permitido:

- archivar;
- etiquetas;
- cambios organizativos.

No para:

- emitir;
- contabilizar;
- presentar.

---

# 153. Responsive invoice

Mobile:

- cliente;
- fechas;
- lines cards;
- total sticky footer;
- CTA.

No intentar replicar grid desktop completo.

---

# 154. Responsive accounting

Mobile:

read-only/consulta prioritaria.

Edición avanzada:

desktop/tablet landscape.

---

# 155. Responsive reconciliation

Mobile:

```text
Transaction
→ Suggestions
→ Reconcile
```

swipe no obligatorio.

---

# 156. Design principles summary

```text
1. Calm financial confidence
2. Lime as signature, not decoration
3. Precision over novelty
4. Progressive disclosure
5. Fast keyboard workflows
6. Explainable tax
7. Dense where professionals need it
8. Friendly where newcomers need it
9. Always preserve context
10. Never hide irreversible consequences
```

---

# 157. Criterios de aceptación UI

Una pantalla no está terminada si falta:

- loading;
- empty;
- error;
- disabled;
- permission denied;
- responsive;
- keyboard;
- validation.

---

# 158. Criterios de aceptación UX

Cada flujo crítico debe probarse con usuarios.

Objetivos iniciales:

## Factura

Usuario experimentado:

```text
< 60 s
```

para factura simple.

## Gasto

```text
< 45 s
```

tras OCR correcto.

## Conciliación

```text
< 10 s
```

para coincidencia clara.

## Encontrar factura

```text
< 10 s
```

desde cualquier pantalla.

---

# 159. Research UX

Antes de GA:

mínimo:

- 5 autónomos;
- 5 pymes;
- 5 contables/asesores.

Casos:

- emitir;
- gasto;
- banco;
- cierre;
- 303.

---

# 160. Métricas UX

Medir:

```text
time-to-first-invoice
invoice-completion-time
reconciliation-time
search-success-rate
form-error-rate
tax-drilldown-usage
support-tickets-per-flow
```

---

# 161. Analytics UX

Eventos:

```text
invoice_started
invoice_issued
invoice_validation_failed
bank_match_accepted
tax_box_opened
tax_record_drilldown
search_used
```

No registrar datos fiscales sensibles innecesarios.

---

# 162. Roadmap de diseño

## P0

- foundations;
- shell;
- dashboard;
- sales;
- purchases;
- banking;
- accounting;
- taxes;
- onboarding;
- settings;
- responsive base;
- accessibility.

## P1

- CRM;
- projects;
- inventory;
- portal;
- advisor mode avanzado;
- dark mode.

## P2

- HR;
- TPV;
- automation builder;
- mobile app;
- analytics advanced.

---

# 163. Entregables de diseño

Para cada módulo:

```text
user flow
wireframes
high-fidelity
prototype
component usage
responsive
states
acceptance criteria
```

---

# 164. Pantallas mínimas P0

## General

- login;
- MFA;
- onboarding;
- dashboard;
- search;
- notifications;
- settings.

## Sales

- invoice list;
- invoice editor;
- invoice detail;
- quote list/editor.

## Purchases

- expense list;
- expense editor;
- OCR review.

## Banking

- bank list;
- transactions;
- reconciliation.

## Accounting

- chart of accounts;
- journal;
- manual entry;
- balance;
- PyG.

## Tax

- dashboard;
- books;
- form list;
- 303 detail;
- 111 detail;
- 115 detail;
- 130 detail;
- SIF status.

---

# 165. Layout templates

Crear templates oficiales:

```text
DashboardLayout
ListLayout
DetailLayout
EditorLayout
SplitLayout
WizardLayout
SettingsLayout
DataGridLayout
```

---

# 166. Detail layout

```text
Header

Primary details
Tabs

Content
```

Sticky actions en documentos.

---

# 167. Split layout

Usar para:

- OCR;
- banco;
- tax drilldown.

---

# 168. Wizard layout

Usar para:

- onboarding;
- import;
- cierre;
- integraciones.

---

# 169. Settings IA

```text
Empresa
├ Datos
├ Facturación
├ Fiscalidad
├ Contabilidad
├ Bancos
├ Usuarios
├ Integraciones
└ Seguridad
```

---

# 170. Configuración fiscal

Debe tener warning:

```text
Estos ajustes afectan a impuestos y contabilidad.
```

Mostrar vigencia.

Ejemplo:

```text
Desde 01/01/2026
```

---

# 171. Change history settings

Configuración fiscal:

```text
Historial
```

permite ver quién cambió qué y cuándo.

---

# 172. Design system governance

Ownership:

```text
Design + Frontend
```

Cambios:

- RFC ligero;
- revisión;
- Storybook;
- Figma;
- release notes.

---

# 173. Token governance

Nunca usar en feature:

```text
#84CC16
```

directamente.

Usar:

```text
brand.primary
```

o CSS token.

---

# 174. Accessibility QA

Automático:

- axe;
- eslint plugins.

Manual:

- keyboard;
- screen reader;
- zoom 200 %;
- contrast.

---

# 175. UX debt

Registrar como backlog:

```text
UX-DEBT
```

No permitir deuda en:

- fiscal actions;
- destructive actions;
- accessibility blockers.

---

# 176. Referencia estética final

La aplicación debe recordar visualmente a una combinación conceptual de:

```text
fintech premium
+
software editorial
+
productividad profesional
```

Pero con identidad propia.

No copiar literalmente patrones visuales, componentes o branding de terceros.

---

# 177. Resultado esperado

El usuario debe percibir:

```text
“Esto parece sencillo”
```

al entrar.

Y un usuario experto debe descubrir:

```text
“Puedo trabajar muy rápido”
```

al profundizar.

---

# 178. Cierre

La dirección visual elegida se resume así:

```text
Base
→ blanco + slate

Identidad
→ lima

Jerarquía
→ tipografía + espacio

Estados
→ semánticos

Complejidad
→ progresiva

Profesionalidad
→ precisión + trazabilidad
```

La interfaz no debe competir con los datos.

Debe convertir un ERP fiscalmente complejo en una herramienta clara, rápida y confiable.
