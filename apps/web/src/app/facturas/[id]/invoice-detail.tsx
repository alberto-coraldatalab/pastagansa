"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { formatMoney } from "@/lib/catalog";
import {
  formatInvoiceDate,
  invoiceIssueKey,
  invoiceStatusLabel,
  type DocumentSequence,
  type Invoice,
  type InvoiceInput,
} from "@/lib/invoices";
import { InvoiceDialog } from "../invoices-view";

export function InvoiceDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [notice, setNotice] = useState("");
  const invoice = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => requestJson<Invoice>(`/api/invoices/${id}`),
    retry: false,
  });
  const updateInvoice = useMutation({
    mutationFn: (payload: InvoiceInput) =>
      requestJson<Invoice>(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(["invoice", id], updated);
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setEditing(false);
      setNotice("Los cambios del borrador se han guardado.");
    },
  });

  if (invoice.isPending)
    return (
      <AppShell active="facturas">
        <section className="detail-loading" aria-live="polite">
          <div className="spinner" />
          <p>Cargando factura…</p>
        </section>
      </AppShell>
    );
  if (invoice.error)
    return (
      <AppShell active="facturas">
        <section className="detail-error">
          <p className="eyebrow">No se pudo abrir</p>
          <h1>Factura no disponible</h1>
          <p>{invoice.error.message}</p>
          <Link className="primary-link" href="/facturas">
            Volver a facturas
          </Link>
        </section>
      </AppShell>
    );

  const document = invoice.data;
  return (
    <AppShell active="facturas">
      <section className="detail-heading">
        <div>
          <Link className="back-link" href="/facturas">
            ← Facturas
          </Link>
          <p className="eyebrow">Documento de venta</p>
          <h1>{document.fullNumber ?? "Factura en borrador"}</h1>
          <p>{document.customerLegalName}</p>
        </div>
        <div className="detail-actions">
          {document.status === "DRAFT" ? (
            <>
              <button
                className="secondary-button"
                onClick={() => setEditing(true)}
              >
                Editar borrador
              </button>
              <button
                className="primary-button compact"
                onClick={() => setIssuing(true)}
              >
                Emitir factura
              </button>
            </>
          ) : (
            <a
              className="primary-link compact"
              href={`/api/invoices/${id}/pdf`}
              download
            >
              Descargar PDF
            </a>
          )}
        </div>
      </section>
      {notice && (
        <div className="notice" role="status">
          <span>✓</span>
          {notice}
          <button onClick={() => setNotice("")} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      )}
      <section className="invoice-summary-grid">
        <article className="summary-card">
          <span>Estado</span>
          <strong>{invoiceStatusLabel(document.status)}</strong>
        </article>
        <article className="summary-card">
          <span>Fecha de emisión</span>
          <strong>{formatInvoiceDate(document.issueDate)}</strong>
        </article>
        <article className="summary-card">
          <span>Vencimiento</span>
          <strong>{formatInvoiceDate(document.dueDate)}</strong>
        </article>
        <article className="summary-card total-card">
          <span>Total</span>
          <strong>{formatMoney(document.total, document.currency)}</strong>
        </article>
      </section>
      <section className="invoice-detail-panel">
        <header>
          <div>
            <h2>Conceptos</h2>
            <p>{document.lines?.length ?? 0} líneas confirmadas por el API</p>
          </div>
        </header>
        <div className="table-scroll">
          <table className="data-table invoice-lines-table">
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>IVA</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {document.lines?.map((line) => (
                <tr key={line.id}>
                  <td>
                    <strong>{line.description}</strong>
                  </td>
                  <td>{formatQuantity(line.quantity)}</td>
                  <td className="money-cell">
                    {formatMoney(line.unitPrice, document.currency)}
                  </td>
                  <td>{Number(line.taxRate)} %</td>
                  <td className="money-cell">
                    {formatMoney(line.totalAmount, document.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="invoice-totals">
          <span>
            Base antes de descuentos{" "}
            <strong>{formatMoney(document.subtotal, document.currency)}</strong>
          </span>
          <span>
            Descuentos{" "}
            <strong>
              − {formatMoney(document.discountTotal, document.currency)}
            </strong>
          </span>
          <span>
            IVA{" "}
            <strong>{formatMoney(document.taxTotal, document.currency)}</strong>
          </span>
          <span className="grand-total">
            Total{" "}
            <strong>{formatMoney(document.total, document.currency)}</strong>
          </span>
        </div>
        {document.notes && (
          <p className="invoice-notes">
            <strong>Notas:</strong> {document.notes}
          </p>
        )}
      </section>
      {editing && (
        <InvoiceDialog
          initial={document}
          pending={updateInvoice.isPending}
          error={updateInvoice.error?.message}
          onClose={() => {
            setEditing(false);
            updateInvoice.reset();
          }}
          onSubmit={(payload) => updateInvoice.mutate(payload)}
        />
      )}
      {issuing && (
        <IssueDialog
          invoice={document}
          onClose={() => setIssuing(false)}
          onIssued={async (issued) => {
            queryClient.setQueryData(["invoice", id], issued);
            await queryClient.invalidateQueries({ queryKey: ["invoices"] });
            setIssuing(false);
            setNotice(`${issued.fullNumber} se ha emitido correctamente.`);
          }}
        />
      )}
    </AppShell>
  );
}

function IssueDialog({
  invoice,
  onClose,
  onIssued,
}: {
  invoice: Invoice;
  onClose(): void;
  onIssued(invoice: Invoice): Promise<void>;
}) {
  const sequences = useQuery({
    queryKey: ["document-sequences"],
    queryFn: () => requestJson<DocumentSequence[]>("/api/document-sequences"),
  });
  const issue = useMutation({
    mutationFn: async ({
      sequenceId,
      series,
    }: {
      sequenceId: string;
      series: string;
    }) => {
      let selectedId = sequenceId;
      if (!selectedId) {
        const created = await requestJson<DocumentSequence>(
          "/api/document-sequences",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ documentType: "INVOICE", series }),
          },
        );
        selectedId = created.id;
      }
      const storageName = `pastagansa:issue:${invoice.id}`;
      const key = invoiceIssueKey(
        invoice.id,
        sessionStorage.getItem(storageName),
      );
      sessionStorage.setItem(storageName, key);
      const issued = await requestJson<Invoice>(
        `/api/invoices/${invoice.id}/issue`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sequenceId: selectedId, idempotencyKey: key }),
        },
      );
      sessionStorage.removeItem(storageName);
      return issued;
    },
    onSuccess: onIssued,
  });
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const active = sequences.data?.filter(
    (sequence) => sequence.active && sequence.documentType === "INVOICE",
  );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    issue.mutate({
      sequenceId: String(values.get("sequenceId") ?? ""),
      series: String(values.get("series") ?? "").trim(),
    });
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="dialog issue-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="issue-title"
      >
        <header>
          <div>
            <p className="eyebrow">Acción irreversible</p>
            <h2 id="issue-title">Emitir factura</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            disabled={issue.isPending}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>
        <p className="issue-warning">
          Al emitir se asignará un número definitivo. El documento dejará de ser
          editable y se generarán sus registros fiscal y contable.
        </p>
        {sequences.isPending && (
          <p className="dialog-helper">Cargando series…</p>
        )}
        {sequences.error && (
          <p className="form-error">{sequences.error.message}</p>
        )}
        {active && (
          <form className="invoice-form" onSubmit={submit}>
            {active.length ? (
              <label className="field">
                <span>Serie de facturación</span>
                <select name="sequenceId" defaultValue={active[0].id} required>
                  {active.map((sequence) => (
                    <option key={sequence.id} value={sequence.id}>
                      {sequence.series} · próximo{" "}
                      {sequence.nextNumber.padStart(sequence.padding, "0")}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="field">
                <span>Nueva serie</span>
                <input
                  name="series"
                  required
                  maxLength={30}
                  pattern="[A-Za-z0-9][A-Za-z0-9._/-]*"
                  defaultValue={`F${invoice.issueDate.slice(0, 4)}`}
                />
                <small>
                  Se creará para esta empresa comenzando por el número 1.
                </small>
              </label>
            )}
            <div className="issue-amount">
              <span>Total definitivo</span>
              <strong>{formatMoney(invoice.total, invoice.currency)}</strong>
            </div>
            {issue.error && (
              <p className="form-error" role="alert">
                {issue.error.message}
              </p>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
                disabled={issue.isPending}
              >
                Seguir editando
              </button>
              <button
                type="submit"
                className="primary-button compact"
                disabled={issue.isPending}
              >
                {issue.isPending ? "Emitiendo…" : "Emitir definitivamente"}
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
  if (!response.ok)
    throw new Error(body.error ?? "No se pudo completar la operación.");
  return body;
}

function formatQuantity(value: string) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 }).format(
    Number(value),
  );
}
