"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { formatMoney } from "@/lib/catalog";
import { formatInvoiceDate } from "@/lib/invoices";
import {
  quoteCode,
  quoteStatusLabel,
  type Quote,
  type QuoteInput,
  type QuoteStatus,
} from "@/lib/quotes";
import { QuoteDialog } from "../quotes-view";

type StatusAction = { status: QuoteStatus; label: string; primary?: boolean };

const actions: Partial<Record<QuoteStatus, StatusAction[]>> = {
  DRAFT: [
    { status: "SENT", label: "Marcar como enviado", primary: true },
    { status: "CANCELLED", label: "Cancelar" },
  ],
  SENT: [
    { status: "ACCEPTED", label: "Registrar aceptación", primary: true },
    { status: "REJECTED", label: "Registrar rechazo" },
    { status: "EXPIRED", label: "Marcar caducado" },
    { status: "CANCELLED", label: "Cancelar" },
  ],
};

export function QuoteDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const quote = useQuery({
    queryKey: ["quote", id],
    queryFn: () => requestJson<Quote>(`/api/quotes/${id}`),
    retry: false,
  });
  const updateQuote = useMutation({
    mutationFn: (payload: QuoteInput) =>
      requestJson<Quote>(`/api/quotes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(["quote", id], updated);
      await queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setEditing(false);
      setNotice("Los cambios del presupuesto se han guardado.");
    },
  });
  const changeStatus = useMutation({
    mutationFn: ({ status, expectedStatus }: { status: QuoteStatus; expectedStatus: QuoteStatus }) =>
      requestJson<Quote>(`/api/quotes/${id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, expectedStatus }),
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(["quote", id], updated);
      await queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setNotice(`El presupuesto ahora figura como ${quoteStatusLabel(updated.status).toLowerCase()}.`);
    },
  });

  if (quote.isPending)
    return (
      <AppShell active="presupuestos">
        <section className="detail-loading" aria-live="polite"><div className="spinner" /><p>Cargando presupuesto…</p></section>
      </AppShell>
    );
  if (quote.error)
    return (
      <AppShell active="presupuestos">
        <section className="detail-error">
          <p className="eyebrow">No se pudo abrir</p>
          <h1>Presupuesto no disponible</h1>
          <p>{quote.error.message}</p>
          <Link className="primary-link" href="/presupuestos">Volver a presupuestos</Link>
        </section>
      </AppShell>
    );

  const document = quote.data;
  const availableActions = actions[document.status] ?? [];
  return (
    <AppShell active="presupuestos">
      <section className="detail-heading">
        <div>
          <Link className="back-link" href="/presupuestos">← Presupuestos</Link>
          <p className="eyebrow">Propuesta comercial</p>
          <h1>{quoteCode(document.code)}</h1>
          <p>{document.customerLegalName}</p>
        </div>
        <div className="detail-actions">
          {document.status === "DRAFT" && (
            <button className="secondary-button" onClick={() => setEditing(true)}>Editar borrador</button>
          )}
          <a className="secondary-button" href={`/api/quotes/${id}/pdf`} download>Descargar PDF</a>
          {availableActions.map((action) => (
            <button
              key={action.status}
              className={action.primary ? "primary-button compact" : "secondary-button"}
              disabled={changeStatus.isPending}
              onClick={() => changeStatus.mutate({ status: action.status, expectedStatus: document.status })}
            >
              {changeStatus.isPending && changeStatus.variables?.status === action.status ? "Guardando…" : action.label}
            </button>
          ))}
        </div>
      </section>
      {notice && (
        <div className="notice" role="status"><span>✓</span>{notice}<button onClick={() => setNotice("")} aria-label="Cerrar aviso">×</button></div>
      )}
      {changeStatus.error && (
        <div className="inline-error" role="alert"><strong>No se pudo cambiar el estado</strong><p>{changeStatus.error.message}</p></div>
      )}
      <section className="invoice-summary-grid">
        <article className="summary-card"><span>Estado</span><strong>{quoteStatusLabel(document.status)}</strong></article>
        <article className="summary-card"><span>Fecha</span><strong>{formatInvoiceDate(document.issueDate)}</strong></article>
        <article className="summary-card"><span>Válido hasta</span><strong>{formatInvoiceDate(document.validUntil)}</strong></article>
        <article className="summary-card total-card"><span>Total</span><strong>{formatMoney(document.total, document.currency)}</strong></article>
      </section>
      <section className="invoice-detail-panel">
        <header>
          <div><h2>Conceptos</h2><p>{document.lines?.length ?? 0} líneas confirmadas por el API</p></div>
        </header>
        <div className="table-scroll">
          <table className="data-table invoice-lines-table">
            <thead><tr><th>Descripción</th><th>Cantidad</th><th>Precio</th><th>Descuento</th><th>IVA</th><th>Total</th></tr></thead>
            <tbody>
              {document.lines?.map((line) => (
                <tr key={line.id}>
                  <td><strong>{line.description}</strong></td>
                  <td>{formatQuantity(line.quantity)}</td>
                  <td className="money-cell">{formatMoney(line.unitPrice, document.currency)}</td>
                  <td>{Number(line.discountPct)} %</td>
                  <td>{Number(line.taxRate)} %</td>
                  <td className="money-cell">{formatMoney(line.totalAmount, document.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="invoice-totals">
          <span>Base antes de descuentos <strong>{formatMoney(document.subtotal, document.currency)}</strong></span>
          <span>Descuentos <strong>− {formatMoney(document.discountTotal, document.currency)}</strong></span>
          <span>IVA <strong>{formatMoney(document.taxTotal, document.currency)}</strong></span>
          <span className="grand-total">Total <strong>{formatMoney(document.total, document.currency)}</strong></span>
        </div>
        {document.notes && <p className="invoice-notes"><strong>Condiciones y notas:</strong> {document.notes}</p>}
      </section>
      {editing && (
        <QuoteDialog
          initial={document}
          pending={updateQuote.isPending}
          error={updateQuote.error?.message}
          onClose={() => { setEditing(false); updateQuote.reset(); }}
          onSubmit={(payload) => updateQuote.mutate(payload)}
        />
      )}
    </AppShell>
  );
}

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "No se pudo completar la operación.");
  return body;
}

function formatQuantity(value: string) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 }).format(Number(value));
}
