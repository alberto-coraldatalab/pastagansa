# Especificación técnica
## ERP SaaS de gestión, contabilidad y fiscalidad para España

**Versión:** 1.0  
**Fecha de referencia:** 8 de septiembre de 2026  
**Arquitectura recomendada:** modular monolith orientado a dominio con eventos internos y capacidad de extraer servicios posteriormente.

---

# 1. Objetivos técnicos

La plataforma debe:

- soportar múltiples organizaciones y empresas;
- garantizar aislamiento de tenants;
- mantener integridad contable y fiscal;
- ser auditable;
- permitir reglas fiscales versionadas;
- soportar emisión transaccional;
- escalar horizontalmente;
- integrarse con AEAT y terceros;
- permitir migraciones sin romper histórico;
- ofrecer API y webhooks;
- aplicar seguridad por diseño.

---

# 2. Atributos de calidad

## 2.1 Integridad

Prioridad máxima.

No debe existir:

- factura emitida sin número;
- factura emitida sin desglose fiscal;
- asiento publicado descuadrado;
- modelo presentado mutable;
- doble factura por retry;
- doble webhook procesado;
- movimiento de stock duplicado;
- acceso cruzado entre empresas.

## 2.2 Disponibilidad

Objetivo inicial:

- 99,9 % mensual para funciones principales.

## 2.3 Rendimiento

Objetivos orientativos:

- API simple p95 < 300 ms;
- búsqueda p95 < 1 s;
- emisión de factura sin espera de terceros < 1 s;
- procesos externos mediante workers;
- reporting pesado asíncrono.

## 2.4 Seguridad

- mínimo privilegio;
- cifrado;
- MFA;
- auditoría;
- segregación;
- rotación de secretos;
- backups protegidos.

---

# 3. Stack recomendado

## 3.1 Frontend

```text
Next.js
React
TypeScript
TanStack Query
React Hook Form
Zod
```

Complementos:

- biblioteca de componentes accesible;
- i18n;
- tabla virtualizada;
- editor de documentos;
- PWA para TPV/portal cuando proceda.

## 3.2 Backend

```text
NestJS
TypeScript
PostgreSQL
Redis
BullMQ
S3 compatible
```

Alternativas razonables:

- Java/Kotlin + Spring;
- .NET;
- Go para servicios especializados.

La decisión más importante es mantener un dominio bien modelado, no el lenguaje.

## 3.3 Infraestructura

- contenedores OCI;
- Kubernetes o servicio administrado equivalente cuando el volumen lo justifique;
- PostgreSQL administrado;
- Redis administrado;
- almacenamiento de objetos;
- CDN;
- WAF;
- gestor de secretos;
- observabilidad centralizada.

---

# 4. Arquitectura lógica

```text
                       ┌───────────────┐
                       │   Frontend    │
                       └───────┬───────┘
                               │
                         HTTPS / API
                               │
                    ┌──────────▼──────────┐
                    │ Application Backend │
                    └──────────┬──────────┘
                               │
     ┌─────────────────────────┼─────────────────────────┐
     ▼                         ▼                         ▼
 Commercial Domain       Accounting Domain          Tax Domain
     │                         │                         │
     └───────────────┬─────────┴─────────┬──────────────┘
                     ▼                   ▼
                 PostgreSQL         Domain Events
                                         │
                           ┌─────────────┼─────────────┐
                           ▼             ▼             ▼
                         Workers       Webhooks      Integrations
                                         │
                           ┌─────────────┼─────────────┐
                           ▼             ▼             ▼
                          AEAT          Banks       External apps
```

---

# 5. Estrategia de módulos

Empezar con modular monolith:

```text
identity
organizations
companies
contacts
catalog
sales
purchases
payments
banking
inventory
accounting
tax
sif
crm
projects
hr
reporting
integrations
audit
```

Cada módulo tendrá:

- entidades de dominio;
- repositorios;
- servicios de aplicación;
- eventos;
- DTO/API;
- pruebas.

No se permitirán imports arbitrarios entre módulos.

---

# 6. Límites de dominio

## 6.1 Sales

Propietario de:

- presupuesto;
- pedido;
- albarán;
- factura de venta;
- rectificación;
- recurrencia.

## 6.2 Purchases

- pedido de compra;
- factura recibida;
- gasto;
- aprobación.

## 6.3 Accounting

- cuenta;
- asiento;
- línea;
- periodo;
- cierre;
- activo;
- centro de coste.

## 6.4 Tax

- perfil fiscal;
- reglas;
- ledger;
- libros;
- declaraciones;
- retenciones.

## 6.5 SIF

- registros de facturación;
- encadenamiento;
- huellas;
- QR;
- remisión;
- respuestas;
- declaración responsable.

---

# 7. Multi-tenancy

Recomendación inicial:

**shared database + shared schema + `organization_id/company_id`**, con controles estrictos.

Todas las tablas de negocio incluirán:

```text
organization_id
company_id
```

## 7.1 Medidas

- Row Level Security opcional/recomendable como segunda barrera;
- scopes de tenant en repositorios;
- índices iniciados por `company_id` en consultas críticas;
- test automático de aislamiento;
- cachés con key tenant-aware;
- jobs con contexto de tenant;
- almacenamiento con prefijo tenant;
- auditoría con tenant.

Nunca confiar solo en un filtro enviado por frontend.

---

# 8. Identidad y autenticación

## 8.1 Métodos

- email/password;
- MFA TOTP;
- SSO OIDC/SAML en plan enterprise;
- magic link para portal;
- service accounts/API keys.

## 8.2 Contraseñas

- Argon2id;
- política adaptativa;
- protección contra credential stuffing;
- rate limiting.

## 8.3 Sesiones

- refresh tokens rotativos;
- revocación;
- device/session listing;
- expiración;
- cookies seguras en web.

---

# 9. Autorización

Modelo RBAC con posibilidad de ABAC.

Permiso:

```text
domain.resource.action
```

Ejemplo:

```text
tax.return.file
```

Scope:

```text
organization
company
team
project
warehouse
```

Las comprobaciones deben existir en backend.

---

# 10. Modelo de datos: organización

```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE companies (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    legal_name TEXT NOT NULL,
    tax_id VARCHAR(40) NOT NULL,
    country CHAR(2) NOT NULL,
    base_currency CHAR(3) NOT NULL DEFAULT 'EUR',
    timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Madrid',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

# 11. Usuarios y membresías

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email CITEXT NOT NULL UNIQUE,
    password_hash TEXT,
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    company_id UUID,
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL,
    UNIQUE(organization_id, company_id, user_id, role_id)
);
```

---

# 12. Perfil fiscal

```sql
CREATE TABLE tax_profiles (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL UNIQUE,

    entity_type VARCHAR(30) NOT NULL,
    accounting_standard VARCHAR(30),
    income_tax_regime VARCHAR(40),
    indirect_tax VARCHAR(20) NOT NULL DEFAULT 'VAT',
    vat_regime VARCHAR(40),
    vat_period VARCHAR(15),

    sii_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    sif_mode VARCHAR(30),

    effective_from DATE NOT NULL,
    effective_to DATE,

    metadata JSONB NOT NULL DEFAULT '{}'
);
```

Los campos parametrizables que puedan cambiar por normativa deben preferir catálogos versionados frente a enums rígidos cuando sea razonable.

---

# 13. Ejercicios y periodos

```sql
CREATE TABLE fiscal_years (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    code VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    UNIQUE(company_id, code)
);

CREATE TABLE period_locks (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    domain VARCHAR(30) NOT NULL,
    period_from DATE NOT NULL,
    period_to DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    locked_at TIMESTAMPTZ,
    locked_by UUID
);
```

---

# 14. Plan contable

```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    code VARCHAR(20) NOT NULL,
    name TEXT NOT NULL,
    parent_id UUID,
    account_class VARCHAR(30),
    is_reconcilable BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(company_id, code)
);
```

Se proveerán seeds versionados para:

- PGC;
- PGC-Pymes.

La numeración sugerida puede personalizarse cuando la norma lo permita.

---

# 15. Diario

```sql
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    fiscal_year_id UUID NOT NULL,
    entry_number BIGINT NOT NULL,
    entry_date DATE NOT NULL,
    description TEXT NOT NULL,
    source_type VARCHAR(50),
    source_id UUID,
    status VARCHAR(20) NOT NULL,
    reversal_of UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    posted_at TIMESTAMPTZ,
    UNIQUE(company_id, fiscal_year_id, entry_number)
);

CREATE TABLE journal_lines (
    id UUID PRIMARY KEY,
    journal_entry_id UUID NOT NULL,
    account_id UUID NOT NULL,
    description TEXT,
    debit NUMERIC(19,4) NOT NULL DEFAULT 0,
    credit NUMERIC(19,4) NOT NULL DEFAULT 0,
    contact_id UUID,
    project_id UUID,
    cost_center_id UUID
);
```

---

# 16. Invariantes contables

Antes de `POSTED`:

```text
SUM(debit) = SUM(credit)
```

Además:

- ninguna línea con debe y haber simultáneamente;
- periodo abierto;
- cuentas activas;
- misma empresa;
- moneda/contravalor válidos.

Un asiento `POSTED` es inmutable.

Corrección:

```text
original
→ reversal
→ corrected entry
```

---

# 17. Documentos de venta

```sql
CREATE TABLE invoices (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    contact_id UUID NOT NULL,

    direction VARCHAR(10) NOT NULL,
    invoice_type VARCHAR(30) NOT NULL,

    series VARCHAR(30) NOT NULL,
    number BIGINT,

    status VARCHAR(30) NOT NULL,

    issue_date DATE,
    operation_date DATE,
    tax_point_date DATE,

    currency CHAR(3) NOT NULL,
    exchange_rate NUMERIC(19,8) NOT NULL DEFAULT 1,

    subtotal NUMERIC(19,4) NOT NULL,
    tax_total NUMERIC(19,4) NOT NULL,
    surcharge_total NUMERIC(19,4) NOT NULL DEFAULT 0,
    withholding_total NUMERIC(19,4) NOT NULL DEFAULT 0,
    total NUMERIC(19,4) NOT NULL,
    amount_due NUMERIC(19,4) NOT NULL,

    issued_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_invoice_number
ON invoices(company_id, series, number)
WHERE number IS NOT NULL;
```

---

# 18. Líneas de factura

```sql
CREATE TABLE invoice_lines (
    id UUID PRIMARY KEY,
    invoice_id UUID NOT NULL,
    line_number INTEGER NOT NULL,
    product_id UUID,
    description TEXT NOT NULL,
    quantity NUMERIC(19,6) NOT NULL,
    unit_price NUMERIC(19,6) NOT NULL,
    discount_percentage NUMERIC(9,6) NOT NULL DEFAULT 0,
    net_amount NUMERIC(19,4) NOT NULL,
    account_id UUID,
    UNIQUE(invoice_id, line_number)
);
```

Dinero:

- NUMERIC/DECIMAL;
- nunca FLOAT.

Redondeos:

- política explícita;
- precisión por moneda;
- cálculo por línea/documento configurable según requisito;
- valores finales persistidos.

---

# 19. Secuencias de factura

Tabla de secuencias:

```sql
CREATE TABLE document_sequences (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    document_type VARCHAR(30) NOT NULL,
    series VARCHAR(30) NOT NULL,
    next_number BIGINT NOT NULL,
    UNIQUE(company_id, document_type, series)
);
```

Asignación:

- transacción;
- lock;
- incrementar;
- idempotencia.

No reservar permanentemente número en un borrador.

---

# 20. Tax Rules

```sql
CREATE TABLE tax_rules (
    id UUID PRIMARY KEY,
    jurisdiction VARCHAR(20) NOT NULL,
    code VARCHAR(50) NOT NULL,
    tax_family VARCHAR(30) NOT NULL,
    operation_type VARCHAR(50) NOT NULL,

    rate NUMERIC(9,6),
    surcharge_rate NUMERIC(9,6),

    subject BOOLEAN NOT NULL,
    exempt BOOLEAN NOT NULL DEFAULT FALSE,
    reverse_charge BOOLEAN NOT NULL DEFAULT FALSE,
    deduction_right BOOLEAN NOT NULL DEFAULT TRUE,

    intra_eu BOOLEAN NOT NULL DEFAULT FALSE,
    import_operation BOOLEAN NOT NULL DEFAULT FALSE,
    export_operation BOOLEAN NOT NULL DEFAULT FALSE,

    special_regime_code VARCHAR(50),
    legal_reference TEXT,

    effective_from DATE NOT NULL,
    effective_to DATE,

    UNIQUE(code, effective_from)
);
```

Regla histórica nunca se modifica para “actualizar” un tipo.

Se crea nueva versión.

---

# 21. Desglose de impuestos

```sql
CREATE TABLE invoice_tax_lines (
    id UUID PRIMARY KEY,
    invoice_id UUID NOT NULL,
    invoice_line_id UUID,
    tax_rule_id UUID NOT NULL,

    taxable_base NUMERIC(19,4) NOT NULL,
    tax_rate NUMERIC(9,6),
    tax_amount NUMERIC(19,4) NOT NULL,

    deductible_percentage NUMERIC(9,6),
    deductible_amount NUMERIC(19,4),

    surcharge_rate NUMERIC(9,6),
    surcharge_amount NUMERIC(19,4),

    exemption_reason VARCHAR(100),
    reverse_charge BOOLEAN NOT NULL DEFAULT FALSE
);
```

---

# 22. Tax Ledger

```sql
CREATE TABLE tax_ledger_entries (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,

    source_type VARCHAR(30) NOT NULL,
    source_id UUID NOT NULL,

    direction VARCHAR(15) NOT NULL,
    book_type VARCHAR(40) NOT NULL,

    issue_date DATE,
    operation_date DATE,
    tax_point_date DATE NOT NULL,
    deduction_date DATE,

    counterparty_id UUID,
    counterparty_tax_id VARCHAR(40),
    counterparty_country CHAR(2),

    document_number VARCHAR(100),
    operation_key VARCHAR(50),
    special_regime VARCHAR(50),

    reverse_charge BOOLEAN NOT NULL DEFAULT FALSE,
    intra_eu BOOLEAN NOT NULL DEFAULT FALSE,
    import_operation BOOLEAN NOT NULL DEFAULT FALSE,
    export_operation BOOLEAN NOT NULL DEFAULT FALSE,

    correction_of UUID,

    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tax_ledger_amounts (
    id UUID PRIMARY KEY,
    tax_ledger_entry_id UUID NOT NULL,
    tax_rule_id UUID NOT NULL,

    taxable_base NUMERIC(19,4) NOT NULL,
    rate NUMERIC(9,6),
    tax_amount NUMERIC(19,4) NOT NULL,

    deductible_percentage NUMERIC(9,6),
    deductible_tax NUMERIC(19,4),

    surcharge_rate NUMERIC(9,6),
    surcharge_amount NUMERIC(19,4)
);
```

Ledger consolidado:

- append-only;
- correcciones como nuevos registros;
- origen rastreable.

---

# 23. Withholding Ledger

```sql
CREATE TABLE withholding_rules (
    id UUID PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    withholding_type VARCHAR(40) NOT NULL,
    rate NUMERIC(9,6),
    periodic_form_code VARCHAR(10),
    annual_form_code VARCHAR(10),
    annual_key VARCHAR(10),
    annual_subkey VARCHAR(10),
    effective_from DATE NOT NULL,
    effective_to DATE
);

CREATE TABLE withholding_entries (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    source_type VARCHAR(30) NOT NULL,
    source_id UUID NOT NULL,
    counterparty_id UUID,
    withholding_rule_id UUID NOT NULL,
    direction VARCHAR(20) NOT NULL,
    accrual_date DATE NOT NULL,
    base_amount NUMERIC(19,4) NOT NULL,
    rate NUMERIC(9,6) NOT NULL,
    withholding_amount NUMERIC(19,4) NOT NULL,
    tax_form_code VARCHAR(10),
    annual_form_code VARCHAR(10),
    annual_key VARCHAR(10),
    annual_subkey VARCHAR(10)
);
```

Dirección:

```text
PRACTISED
SUFFERED
```

---

# 24. IRPF Ledger

```sql
CREATE TABLE irpf_ledger_entries (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    activity_id UUID NOT NULL,
    source_type VARCHAR(30),
    source_id UUID,
    entry_date DATE NOT NULL,

    book_type VARCHAR(30) NOT NULL,
    category_code VARCHAR(50),

    counterparty_tax_id VARCHAR(40),

    gross_amount NUMERIC(19,4),
    fiscal_amount NUMERIC(19,4),
    deductible_percentage NUMERIC(9,6),

    withholding_amount NUMERIC(19,4),
    notes TEXT
);
```

Debe poder generar libros oficiales normalizados.

---

# 25. Declaraciones tributarias

```sql
CREATE TABLE tax_form_versions (
    id UUID PRIMARY KEY,
    form_code VARCHAR(10) NOT NULL,
    tax_year INTEGER NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    schema_version VARCHAR(30) NOT NULL,
    UNIQUE(form_code, tax_year, schema_version)
);

CREATE TABLE tax_form_boxes (
    id UUID PRIMARY KEY,
    form_version_id UUID NOT NULL,
    box_code VARCHAR(20) NOT NULL,
    label TEXT NOT NULL,
    value_type VARCHAR(20) NOT NULL,
    calculation_expression JSONB,
    UNIQUE(form_version_id, box_code)
);

CREATE TABLE tax_returns (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    form_version_id UUID NOT NULL,
    tax_year INTEGER NOT NULL,
    period VARCHAR(10) NOT NULL,
    status VARCHAR(30) NOT NULL,
    calculated_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    filed_at TIMESTAMPTZ,
    filing_reference VARCHAR(100),
    result_amount NUMERIC(19,4),
    snapshot JSONB NOT NULL
);
```

---

# 26. Motor de modelos

Pipeline:

```text
Tax Ledger
→ selector de periodo
→ reglas de inclusión/exclusión
→ agregaciones
→ casillas
→ validaciones cruzadas
→ snapshot
```

Cada casilla debe ser explicable.

API interna:

```text
calculate(form, company, period, version)
explain(form, box)
listSourceEntries(form, box)
validate(form)
freeze(form)
```

---

# 27. Motor contable

No incluir lógica específica en controllers.

Pipeline:

```text
Domain Event
→ Accounting Rule Resolver
→ Accounting Draft
→ Validation
→ Journal Entry
→ Post
```

Regla:

```sql
CREATE TABLE accounting_rules (
    id UUID PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    accounting_standard VARCHAR(30),
    conditions JSONB NOT NULL,
    debit_formula JSONB NOT NULL,
    credit_formula JSONB NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE
);
```

---

# 28. Evento de emisión

Transacción conceptual:

```text
BEGIN

SELECT sequence FOR UPDATE

validate invoice
assign number
persist frozen totals
persist tax breakdown
create tax ledger
resolve accounting rules
create/post journal entry
create SIF record if applicable
write audit event
write outbox events
mark invoice issued

COMMIT
```

Las llamadas externas se hacen después vía outbox/worker.

---

# 29. Outbox Pattern

```sql
CREATE TABLE outbox_events (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id UUID NOT NULL,
    payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0
);
```

Permite garantizar que un commit de negocio no pierda eventos.

---

# 30. Idempotencia

Para operaciones críticas:

```text
Idempotency-Key
```

Tabla:

```sql
CREATE TABLE idempotency_keys (
    company_id UUID NOT NULL,
    key VARCHAR(200) NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    response_code INTEGER,
    response_body JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    PRIMARY KEY(company_id, key)
);
```

Aplicar a:

- emisión;
- cobros;
- webhooks entrantes;
- importaciones;
- remisiones AEAT.

---

# 31. SIF

Tabla orientativa:

```sql
CREATE TABLE sif_records (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    invoice_id UUID,

    record_type VARCHAR(20) NOT NULL,

    generated_at TIMESTAMPTZ NOT NULL,

    previous_record_hash VARCHAR(256),
    record_hash VARCHAR(256) NOT NULL,

    payload JSONB NOT NULL,
    signature BYTEA,

    aeat_status VARCHAR(30),
    aeat_reference VARCHAR(200),
    submitted_at TIMESTAMPTZ,
    response JSONB
);
```

La estructura exacta del payload/huella debe seguir las especificaciones vigentes.

No inventar algoritmos; encapsularlos en un componente versionado.

---

# 32. SIF Engine

Interfaces:

```ts
interface SifRecordBuilder {
  buildCreateRecord(invoiceId: string): Promise<SifRecord>;
  buildCancellationRecord(invoiceId: string): Promise<SifRecord>;
}

interface SifHasher {
  hash(record: SifRecord, version: string): string;
}

interface VerifactuSender {
  submit(batch: SifRecord[]): Promise<SubmissionResult>;
}
```

Versionar por especificación.

---

# 33. Declaración responsable

Persistir:

- nombre software;
- versión;
- productor;
- identificación;
- dirección;
- texto;
- fecha;
- hash del artefacto;
- configuración aplicable.

Mostrar dentro de la aplicación cuando sea exigible.

---

# 34. QR

Componente:

```text
Invoice PDF
→ Fiscal QR renderer
```

Separar:

- QR fiscal;
- QR/enlace de pago;
- QR del portal.

Nunca reutilizar uno como otro.

---

# 35. SII

Adaptador:

```text
Tax Ledger
→ SII Mapper
→ XML/Service payload
→ AEAT
→ Response log
```

Persistir:

- envío;
- respuesta;
- estado;
- errores;
- reintentos;
- versión de esquema.

---

# 36. Factura electrónica B2B

Crear modelo canónico independiente:

```text
CanonicalInvoice
```

Adaptadores:

```text
UBL
CII
Facturae
EDIFACT
otros formatos admitidos
```

Gateway:

```text
CanonicalInvoice
→ Format Adapter
→ Network/Platform Adapter
→ Delivery Status
→ Business Status
```

No duplicar lógica fiscal por formato.

---

# 37. Bancos

## 37.1 Entidades

```text
BankConnection
BankAccount
BankTransaction
Payment
Reconciliation
```

## 37.2 Normalización

Cada proveedor bancario se adapta a:

```text
NormalizedBankTransaction
```

Campos:

- external_id;
- date;
- value_date;
- amount;
- currency;
- description;
- counterparty;
- IBAN;
- reference.

## 37.3 Matching

Score configurable:

```text
amount
date
reference
counterparty
invoice number
IBAN
historical behavior
```

No ejecutar conciliación irreversible sin reglas claras.

---

# 38. OCR y documentos

Pipeline:

```text
Upload
→ antivirus
→ object storage
→ extraction
→ classifier
→ field extraction
→ confidence
→ human review
→ business document
```

Guardar:

- archivo original;
- checksum;
- versión OCR;
- resultado;
- confianza;
- correcciones.

No usar OCR como fuente fiscal definitiva.

---

# 39. Almacenamiento de archivos

S3 compatible.

Ruta lógica:

```text
organization/company/entity/yyyy/mm/object
```

Características:

- cifrado;
- versionado cuando proceda;
- retención;
- URLs firmadas;
- antivirus;
- checksum;
- metadata.

---

# 40. API pública

Base:

```text
/api/v1
```

Recursos:

```text
companies
contacts
products
services
quotes
orders
invoices
expenses
payments
bank-transactions
journal-entries
projects
employees
```

Fiscalidad con scopes especiales.

---

# 41. Convenciones API

- JSON;
- OpenAPI;
- pagination cursor;
- filtros;
- sorting;
- RFC 3339;
- códigos ISO;
- problemas con formato consistente;
- request ID;
- versionado.

Errores:

```json
{
  "code": "INVOICE_PERIOD_LOCKED",
  "message": "El periodo fiscal está bloqueado",
  "details": {},
  "request_id": "..."
}
```

---

# 42. Webhooks

Salida firmada HMAC.

Cabeceras:

```text
X-Webhook-Id
X-Webhook-Timestamp
X-Webhook-Signature
```

Reintentos exponenciales.

Eventos idempotentes.

El receptor puede consultar el recurso para recuperar estado actual.

---

# 43. Jobs

BullMQ u otro scheduler.

Tipos:

- recurrent invoices;
- email;
- OCR;
- bank sync;
- SIF send;
- SII send;
- webhooks;
- imports;
- exports;
- reports;
- notifications.

Cada job:

- idempotente;
- con timeout;
- retries;
- dead-letter;
- correlation ID.

---

# 44. Cache

Redis para:

- sesiones;
- rate limits;
- cache corto;
- locks distribuidos específicos;
- colas.

No usar Redis como sistema de registro fiscal/contable.

---

# 45. Búsqueda

Primera fase:

- PostgreSQL full-text/trigram.

Escalado:

- OpenSearch/Elasticsearch si el volumen lo exige.

El índice nunca será fuente de verdad.

---

# 46. Seguridad de aplicación

## 46.1 OWASP

Controles frente a:

- injection;
- XSS;
- CSRF;
- SSRF;
- broken access control;
- upload abuse;
- deserialización insegura;
- dependencia vulnerable.

## 46.2 Rate limiting

Por:

- IP;
- usuario;
- API key;
- tenant;
- endpoint sensible.

## 46.3 Secrets

Secret manager.

Nunca:

- `.env` de producción en repositorio;
- certificados AEAT en texto plano;
- credenciales bancarias sin cifrado.

---

# 47. Cifrado

- TLS 1.2+ / preferentemente 1.3;
- cifrado en reposo administrado;
- envelope encryption para secretos de alta sensibilidad;
- claves rotables.

Campos de especial protección pueden usar cifrado de aplicación.

---

# 48. RGPD

Diseño:

- minimización;
- finalidad;
- trazabilidad;
- retención;
- exportación;
- derechos;
- separación entre eliminación de cuenta y conservación legal.

Registro de tratamiento no sustituye al cumplimiento organizativo, pero la aplicación debe facilitarlo.

---

# 49. Auditoría

Tabla append-oriented:

```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    company_id UUID,
    actor_user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    before_data JSONB,
    after_data JSONB,
    ip INET,
    user_agent TEXT,
    occurred_at TIMESTAMPTZ NOT NULL
);
```

Para acciones fiscales críticas puede usarse almacenamiento WORM/retención adicional.

---

# 50. Logging

Log estructurado.

Campos:

- timestamp;
- level;
- service;
- environment;
- request_id;
- trace_id;
- user_id anonimizable;
- company_id;
- event.

Nunca incluir:

- contraseñas;
- tokens;
- certificados;
- datos bancarios completos;
- documentación sensible innecesaria.

---

# 51. Observabilidad

## Métricas

- latencia;
- error rate;
- throughput;
- DB pool;
- lag de workers;
- SIF queue;
- SII queue;
- bank sync;
- OCR;
- webhook delivery.

## Tracing

OpenTelemetry.

## Alertas

- error spike;
- cola bloqueada;
- fallos de AEAT;
- secuencias;
- storage;
- backups;
- RLS/auth anomalies.

---

# 52. Backups

PostgreSQL:

- backup continuo/PITR;
- snapshots;
- copias cruzadas;
- pruebas periódicas de restore.

Objetivos orientativos:

- RPO <= 15 min;
- RTO <= 4 h para MVP;
- mejorar por plan empresarial.

No basta con “tener backups”: se debe ensayar restauración.

---

# 53. Continuidad

Runbooks:

- caída DB;
- caída Redis;
- proveedor bancario;
- AEAT no disponible;
- storage;
- incidente de seguridad;
- corrupción de datos;
- despliegue defectuoso.

Las dependencias fiscales externas deben poder quedar en cola sin bloquear el núcleo innecesariamente.

---

# 54. Despliegue

Entornos:

```text
local
dev
test
staging
production
```

Staging debe usar integraciones sandbox/pruebas externas cuando existan.

---

# 55. CI/CD

Pipeline:

```text
lint
→ typecheck
→ unit tests
→ integration tests
→ migrations validation
→ security scans
→ build
→ e2e
→ deploy staging
→ smoke
→ approval
→ production
```

Migraciones forward-only preferentemente.

---

# 56. Estrategia de migraciones

Herramienta:

- Prisma migrations / TypeORM migrations / Flyway / Liquibase.

Reglas:

- no renombrar/eliminar columnas críticas en un solo paso;
- expand/contract;
- backfills asíncronos;
- validación de checks;
- rollback mediante release, no improvisación SQL.

---

# 57. Versionado normativo

Toda regla:

```text
version
effective_from
effective_to
legal_reference
```

Todo modelo:

```text
form_code
tax_year
schema_version
```

Todo adaptador externo:

```text
provider
protocol_version
valid_from
```

Histórico debe recalcularse con la versión que le correspondía, no con la actual.

---

# 58. Pruebas unitarias

Cobertura crítica:

- redondeos;
- impuestos;
- retenciones;
- secuencias;
- reglas contables;
- cierres;
- idempotencia;
- permissions.

No perseguir solo porcentaje de cobertura; usar casos normativos.

---

# 59. Pruebas de integración

Casos:

- emisión completa;
- reversión;
- rectificación;
- pago;
- conciliación;
- importación;
- SIF;
- SII;
- modelo 303;
- 111/190;
- 115/180;
- 130.

---

# 60. Golden tests fiscales

Guardar fixtures:

```text
input document
expected tax ledger
expected journal
expected book rows
expected form boxes
```

Ejemplo:

```yaml
case: professional_invoice_15
base: 1000
vat: 210
withholding: 150
payable: 1060
```

El test falla si cualquier capa difiere.

---

# 61. Property-based tests

Útiles para:

- total de factura;
- redondeos;
- sumas debe/haber;
- reversión;
- duplicados;
- matching de periodos.

---

# 62. E2E

Flujos principales:

1. alta empresa;
2. alta cliente;
3. emitir;
4. enviar;
5. cobrar;
6. importar banco;
7. conciliar;
8. revisar asiento;
9. revisar libro;
10. calcular 303.

---

# 63. Performance tests

Escenarios:

- 1 M facturas tenant grande;
- 10 M movimientos agregados;
- cierre mensual;
- exportación libros;
- conciliación masiva;
- dashboard;
- 1.000 remisiones.

Definir umbrales antes de producción.

---

# 64. Seguridad en SDLC

- SAST;
- dependency scanning;
- secret scanning;
- container scanning;
- DAST en staging;
- pentest antes de GA;
- revisión específica multi-tenant.

---

# 65. Calidad de datos

Constraints:

- foreign keys;
- unique;
- check;
- not null;
- estados válidos.

Evitar que la capa de aplicación sea la única protección.

---

# 66. Arquitectura de reporting

Inicial:

- vistas SQL;
- materialized views para agregaciones.

Posterior:

```text
Operational DB
→ CDC/ETL
→ Warehouse
→ BI
```

Nunca impactar emisión de facturas con consultas analíticas pesadas.

---

# 67. Integraciones: patrón

Cada integración:

```text
Provider Adapter
├── Auth
├── Mapper
├── Client
├── Retry policy
├── Error translator
└── Health
```

Dominio no depende de SDK propietario.

---

# 68. Open Banking

Mantener:

- consentimiento;
- conexión;
- expiración;
- cuentas;
- última sync;
- proveedor;
- external IDs.

No guardar credenciales bancarias innecesarias.

---

# 69. Pasarela de pagos

Modelo:

```text
PaymentIntent
Payment
Refund
ProviderEvent
```

Webhooks entrantes:

- verificar firma;
- idempotencia;
- persistir evento;
- procesar.

---

# 70. Emails

Servicio desacoplado:

- templates;
- tracking opcional;
- bounce;
- attachments;
- provider failover en fase avanzada.

Facturas no deben depender de que email se envíe para quedar emitidas.

---

# 71. Feature flags

Uso para:

- módulos beta;
- cambios fiscales por cohortes;
- integraciones;
- rollout.

No usar feature flags como sustituto del versionado fiscal.

---

# 72. Configuración

Jerarquía:

```text
global defaults
→ country
→ company
→ user
```

Cualquier configuración con efecto fiscal debe quedar auditada.

---

# 73. Dependencias temporales

Usar reloj inyectable.

Nunca `new Date()` disperso en reglas.

Permite probar:

- cierres;
- cambios de tipo;
- vigencias;
- deadlines.

---

# 74. Monedas

Guardar:

- currency;
- exchange rate;
- source;
- date;
- base currency amount.

Diferencias de cambio deben poder generar asiento.

---

# 75. Centros de coste y proyectos

Dimensiones contables:

```text
journal_line
→ project
→ cost_center
→ department
```

No alterar el equilibrio contable.

---

# 76. Inventario

Modelo:

```text
StockMovement
```

append-oriented.

Saldo derivado o materializado.

Evitar editar el saldo directamente.

---

# 77. Documentación técnica

Obligatoria:

- OpenAPI;
- ADRs;
- diagramas;
- modelo de datos;
- runbooks;
- reglas fiscales;
- catálogo de eventos;
- permisos;
- manual de integraciones.

---

# 78. ADRs iniciales

Crear al menos:

- ADR-001 Modular monolith;
- ADR-002 Multi-tenancy;
- ADR-003 Tax Ledger;
- ADR-004 Accounting Engine;
- ADR-005 Invoice immutability;
- ADR-006 Outbox;
- ADR-007 SIF adapter;
- ADR-008 Versioned tax rules;
- ADR-009 Decimal/money;
- ADR-010 Audit strategy.

---

# 79. Riesgos técnicos principales

| Riesgo | Impacto | Mitigación |
|---|---:|---|
| Reglas fiscales hardcodeadas | Crítico | Motor versionado |
| Doble emisión | Crítico | Locks + idempotencia |
| Mezcla de tenants | Crítico | scopes + RLS + tests |
| Asientos descuadrados | Crítico | constraints/validación transaccional |
| Cambio AEAT | Alto | adaptadores versionados |
| Dependencia bancaria | Medio/alto | adapter + reintentos |
| OCR incorrecto | Medio | confidence + revisión |
| Reporting degrada OLTP | Alto | vistas/materialización/warehouse |
| Migración destructiva | Crítico | expand/contract |

---

# 80. Criterios técnicos de salida a producción

No se libera P0 hasta cumplir:

- aislamiento multi-tenant probado;
- emisión idempotente;
- secuencias concurrentes probadas;
- fiscal golden tests aprobados;
- asientos invariantes;
- backup restore probado;
- pentest/revisión de seguridad;
- SIF probado según especificaciones vigentes;
- audit trail;
- monitorización;
- runbooks;
- migración piloto;
- revisión contable/fiscal.

---

# 81. Referencias oficiales

- PGC: https://www.boe.es/buscar/act.php?id=BOE-A-2007-19884
- PGC-Pymes: https://www.boe.es/buscar/act.php?id=BOE-A-2007-19966
- Reglamento de facturación: https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696
- RD 1007/2023 SIF: https://www.boe.es/buscar/doc.php?id=BOE-A-2023-24840
- Orden HAC/1177/2024: https://www.boe.es/buscar/act.php?id=BOE-A-2024-22138
- AEAT VERI*FACTU: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes.html
- Libros IVA: https://sede.agenciatributaria.gob.es/Sede/iva/libros-registro.html
- Libros electrónicos 2026: https://sede.agenciatributaria.gob.es/Sede/iva/facturacion-registro/libros-registro-iva/libro-registro-soporte-electronico.html
- Modelo 303 2026: https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/iva/modelo-303-iva-autoliquidacion_/instrucciones-2026/instrucciones-02-12-2t-4t-2026.html
- Obligaciones IRPF: https://sede.agenciatributaria.gob.es/Sede/irpf/Obligaciones.html
- Retenciones 2026: https://sede.agenciatributaria.gob.es/Sede/Retenciones.shtml
- SII: https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G417.shtml
- RD 238/2026 factura electrónica B2B: https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-7295

---

# 82. Conclusión

La arquitectura debe hacer que la integridad fiscal y contable sea una propiedad del sistema, no una función opcional de la interfaz.

La cadena crítica es:

```text
Business Event
→ Domain Validation
→ Tax Engine
→ Tax Ledger
→ Accounting Engine
→ Immutable Records
→ External Adapters
```

Toda decisión de implementación debe preservar esa cadena.
