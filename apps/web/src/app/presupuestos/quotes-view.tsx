"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { formatMoney, type CatalogPage } from "@/lib/catalog";
import { type ContactPage } from "@/lib/contacts";
import { formatInvoiceDate, todayIso } from "@/lib/invoices";
import {
  defaultQuoteExpiry,
  quoteCode,
  quoteStatusLabel,
  type Quote,
  type QuoteInput,
  type QuotePage,
  type QuoteStatus,
} from "@/lib/quotes";

type StatusFilter = "" | QuoteStatus;

export function QuotesView() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("");
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<(string | undefined)[]>([]);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const quotes = useQuery({
    queryKey: ["quotes", status, cursor],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "20" });
      if (status) params.set("status", status);
      if (cursor) params.set("cursor", cursor);
      return requestJson<QuotePage>(`/api/quotes?${params}`);
    },
  });
  const createQuote = useMutation({
    mutationFn: (payload: QuoteInput) =>
      requestJson<Quote>("/api/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: async (quote) => {
      await queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setCreating(false);
      setNotice(
        `${quoteCode(quote.code)} guardado por ${formatMoney(quote.total, quote.currency)}.`,
      );
    },
  });

  function changeStatus(next: StatusFilter) {
    setStatus(next);
    setCursor(undefined);
    setHistory([]);
    setNotice("");
  }

  return (
    <AppShell active="presupuestos">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Ventas · Propuestas</p>
          <h1>Presupuestos</h1>
          <p>Crea, envía y registra la decisión del cliente.</p>
        </div>
        <button className="primary-button compact" onClick={() => setCreating(true)}>
          Nuevo presupuesto
        </button>
      </section>
      {notice && (
        <div className="notice" role="status">
          <span>✓</span>
          {notice}
          <button onClick={() => setNotice("")} aria-label="Cerrar aviso">×</button>
        </div>
      )}
      <section className="data-panel" aria-labelledby="quotes-title">
        <div className="data-toolbar invoice-toolbar">
          <div>
            <h2 id="quotes-title">Ofertas comerciales</h2>
            <p>{quotes.data ? `${quotes.data.data.length} en esta página` : "Cargando…"}</p>
          </div>
          <label className="filter-field">
            <span>Estado</span>
            <select value={status} onChange={(event) => changeStatus(event.target.value as StatusFilter)}>
              <option value="">Todos</option>
              <option value="DRAFT">Borradores</option>
              <option value="SENT">Enviados</option>
              <option value="ACCEPTED">Aceptados</option>
              <option value="REJECTED">Rechazados</option>
              <option value="EXPIRED">Caducados</option>
              <option value="CANCELLED">Cancelados</option>
              <option value="CONVERTED">Convertidos</option>
            </select>
          </label>
        </div>
        {quotes.isPending && <LoadingRows />}
        {quotes.error && (
          <div className="inline-error" role="alert">
            <strong>No se pudieron cargar los presupuestos</strong>
            <p>{quotes.error.message}</p>
            <button onClick={() => void quotes.refetch()}>Reintentar</button>
          </div>
        )}
        {quotes.data?.data.length === 0 && (
          <div className="empty-state">
            <span>PR</span>
            <h3>{status ? "No hay presupuestos en este estado" : "Crea tu primer presupuesto"}</h3>
            <p>
              {status
                ? "Selecciona otro estado para ampliar la búsqueda."
                : "Prepara una oferta revisable y descárgala en PDF antes de enviarla."}
            </p>
            {!status && (
              <button className="secondary-button" onClick={() => setCreating(true)}>
                Nuevo presupuesto
              </button>
            )}
          </div>
        )}
        {!!quotes.data?.data.length && <QuoteTable items={quotes.data.data} />}
        {(history.length > 0 || quotes.data?.nextCursor) && (
          <div className="pagination" aria-label="Paginación de presupuestos">
            <button
              disabled={!history.length}
              onClick={() => {
                const previous = history.at(-1);
                setHistory((items) => items.slice(0, -1));
                setCursor(previous);
              }}
            >
              Anterior
            </button>
            <button
              disabled={!quotes.data?.nextCursor}
              onClick={() => {
                setHistory((items) => [...items, cursor]);
                setCursor(quotes.data?.nextCursor ?? undefined);
              }}
            >
              Siguiente
            </button>
          </div>
        )}
      </section>
      {creating && (
        <QuoteDialog
          pending={createQuote.isPending}
          error={createQuote.error?.message}
          onClose={() => {
            setCreating(false);
            createQuote.reset();
          }}
          onSubmit={(payload) => createQuote.mutate(payload)}
        />
      )}
    </AppShell>
  );
}

function QuoteTable({ items }: { items: Quote[] }) {
  return (
    <div className="table-scroll">
      <table className="data-table invoice-table">
        <thead>
          <tr>
            <th>Presupuesto</th>
            <th>Cliente</th>
            <th>Fecha</th>
            <th>Validez</th>
            <th>Estado</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((quote) => (
            <tr key={quote.id}>
              <td>
                <Link className="table-link" href={`/presupuestos/${quote.id}`}>
                  {quoteCode(quote.code)}
                </Link>
                <small>Presupuesto</small>
              </td>
              <td>
                <strong>{quote.customerLegalName}</strong>
                <small>{quote.customerTaxId ?? "Sin NIF"}</small>
              </td>
              <td>{formatInvoiceDate(quote.issueDate)}</td>
              <td>{formatInvoiceDate(quote.validUntil)}</td>
              <td>
                <span className={`tag ${quote.status === "DRAFT" ? "tag-neutral" : ""}`}>
                  {quoteStatusLabel(quote.status)}
                </span>
              </td>
              <td className="money-cell">{formatMoney(quote.total, quote.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface EditableLine {
  key: number;
  catalogItemId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPct: string;
  taxRate: "21" | "10" | "4";
}

let nextLineKey = 1;
const blankLine = (): EditableLine => ({
  key: nextLineKey++,
  catalogItemId: "",
  description: "",
  quantity: "1",
  unitPrice: "",
  discountPct: "0",
  taxRate: "21",
});

export function QuoteDialog({
  pending,
  error,
  initial,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  error?: string;
  initial?: Quote;
  onClose(): void;
  onSubmit(payload: QuoteInput): void;
}) {
  const [issueDate, setIssueDate] = useState(initial?.issueDate.slice(0, 10) ?? todayIso());
  const [validUntil, setValidUntil] = useState(
    initial?.validUntil?.slice(0, 10) ??
      defaultQuoteExpiry(initial?.issueDate.slice(0, 10) ?? todayIso()),
  );
  const [lines, setLines] = useState<EditableLine[]>(() =>
    initial?.lines?.length
      ? initial.lines.map((line) => ({
          key: nextLineKey++,
          catalogItemId: line.catalogItemId ?? "",
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountPct: line.discountPct,
          taxRate: supportedRate(line.taxRate),
        }))
      : [blankLine()],
  );
  const customers = useQuery({
    queryKey: ["quote-customers"],
    queryFn: () => loadOptions<ContactPage>("/api/contacts?kind=CUSTOMER&limit=100"),
  });
  const catalog = useQuery({
    queryKey: ["quote-catalog"],
    queryFn: () => loadOptions<CatalogPage>("/api/catalog?limit=100"),
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, pending]);

  function updateLine(key: number, changes: Partial<EditableLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...changes } : line)));
  }

  function selectCatalog(line: EditableLine, itemId: string) {
    const item = catalog.data?.data.find((candidate) => candidate.id === itemId);
    updateLine(line.key, {
      catalogItemId: itemId,
      ...(item
        ? {
            description: item.description || item.name,
            unitPrice: item.salesPrice ?? "",
            taxRate: suggestedRate(item.suggestedTaxCode),
          }
        : {}),
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onSubmit({
      contactId: String(values.get("contactId")),
      issueDate: String(values.get("issueDate")),
      validUntil: String(values.get("validUntil")),
      currency: "EUR",
      notes: String(values.get("notes") ?? "").trim() || undefined,
      lines: lines.map((line) => ({
        catalogItemId: line.catalogItemId || undefined,
        description: line.description.trim(),
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        discountPct: Number(line.discountPct),
        taxRate: Number(line.taxRate) as 21 | 10 | 4,
      })),
    });
  }

  const loading = customers.isPending || catalog.isPending;
  const loadError = customers.error?.message ?? catalog.error?.message;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) onClose();
    }}>
      <section className="dialog invoice-dialog" role="dialog" aria-modal="true" aria-labelledby="quote-dialog-title">
        <header>
          <div>
            <p className="eyebrow">{initial ? "Editar propuesta" : "Nueva propuesta"}</p>
            <h2 id="quote-dialog-title">{initial ? "Editar presupuesto" : "Presupuesto en borrador"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} disabled={pending} aria-label="Cerrar">×</button>
        </header>
        {loading && <p className="dialog-helper">Cargando clientes y catálogo…</p>}
        {loadError && <p className="form-error">{loadError}</p>}
        {!loading && !loadError && !customers.data?.data.length && (
          <div className="invoice-prerequisites">
            <strong>Faltan datos para presupuestar</strong>
            <p>Necesitas al menos un cliente activo.</p>
            <div><Link href="/clientes">Crear cliente</Link></div>
          </div>
        )}
        {!loading && !loadError && !!customers.data?.data.length && catalog.data && (
          <form className="invoice-form" onSubmit={submit}>
            <div className="invoice-basics">
              <label className="field invoice-customer">
                <span>Cliente</span>
                <select name="contactId" required defaultValue={initial?.contactId ?? ""}>
                  <option value="" disabled>Selecciona un cliente</option>
                  {customers.data.data.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.legalName}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Fecha</span>
                <input
                  name="issueDate"
                  type="date"
                  required
                  value={issueDate}
                  onChange={(event) => {
                    const nextIssueDate = event.target.value;
                    setIssueDate(nextIssueDate);
                    if (validUntil < nextIssueDate)
                      setValidUntil(defaultQuoteExpiry(nextIssueDate));
                  }}
                />
              </label>
              <label className="field">
                <span>Válido hasta</span>
                <input
                  name="validUntil"
                  type="date"
                  min={issueDate}
                  value={validUntil}
                  onChange={(event) => setValidUntil(event.target.value)}
                />
              </label>
            </div>
            <div className="invoice-lines-heading">
              <div><strong>Conceptos</strong><small>El API calculará bases, descuentos e IVA.</small></div>
              <button type="button" className="secondary-button" onClick={() => setLines((current) => [...current, blankLine()])}>
                Añadir línea
              </button>
            </div>
            <div className="invoice-lines">
              {lines.map((line, index) => (
                <div className="invoice-line" key={line.key}>
                  <div className="invoice-line-title">
                    <strong>Línea {index + 1}</strong>
                    {lines.length > 1 && (
                      <button type="button" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>Eliminar</button>
                    )}
                  </div>
                  <label className="field invoice-item">
                    <span>Catálogo</span>
                    <select value={line.catalogItemId} onChange={(event) => selectCatalog(line, event.target.value)}>
                      <option value="">Concepto libre</option>
                      {catalog.data.data.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}{item.sku ? ` · ${item.sku}` : ""}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field invoice-description">
                    <span>Descripción</span>
                    <input required maxLength={2000} value={line.description} onChange={(event) => updateLine(line.key, { description: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Cantidad</span>
                    <input required type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Precio</span>
                    <input required type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Descuento %</span>
                    <input required type="number" min="0" max="100" step="0.01" value={line.discountPct} onChange={(event) => updateLine(line.key, { discountPct: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>IVA</span>
                    <select value={line.taxRate} onChange={(event) => updateLine(line.key, { taxRate: event.target.value as EditableLine["taxRate"] })}>
                      <option value="21">21 %</option><option value="10">10 %</option><option value="4">4 %</option>
                    </select>
                  </label>
                </div>
              ))}
            </div>
            <label className="field">
              <span>Condiciones y notas (opcional)</span>
              <textarea name="notes" rows={3} maxLength={5000} defaultValue={initial?.notes ?? ""} />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={onClose} disabled={pending}>Cancelar</button>
              <button type="submit" className="primary-button compact" disabled={pending}>
                {pending ? "Guardando…" : initial ? "Guardar cambios" : "Guardar borrador"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "No se pudo completar la operación.");
  return body;
}

async function loadOptions<T>(path: string) {
  return requestJson<T>(path);
}

function suggestedRate(code: string | null): EditableLine["taxRate"] {
  if (code === "ES_VAT_REDUCED_10") return "10";
  if (code === "ES_VAT_SUPER_REDUCED_4") return "4";
  return "21";
}

function supportedRate(value: string): EditableLine["taxRate"] {
  const rate = Number(value);
  if (rate === 10) return "10";
  if (rate === 4) return "4";
  return "21";
}

function LoadingRows() {
  return (
    <div className="empty-state loading-rows" aria-live="polite">
      <span /><span /><span /><p>Cargando presupuestos…</p>
    </div>
  );
}
