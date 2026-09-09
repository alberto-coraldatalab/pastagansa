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
  paymentKey,
  paymentMethodLabel,
  todayIso,
  type DocumentSequence,
  type Invoice,
  type InvoiceInput,
  type Payment,
  type PaymentInput,
  type PaymentInstallment,
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
        <article className="summary-card">
          <span>Cobrado</span>
          <strong>{formatMoney(document.amountPaid, document.currency)}</strong>
        </article>
        <article className="summary-card due-card">
          <span>Pendiente</span>
          <strong>{formatMoney(document.amountDue, document.currency)}</strong>
        </article>
      </section>
      {document.status !== "DRAFT" && <PaymentsPanel invoice={document} />}
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

function PaymentsPanel({ invoice }: { invoice: Invoice }) {
  const queryClient = useQueryClient();
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState("");
  const payments = useQuery({
    queryKey: ["invoice-payments", invoice.id],
    queryFn: () =>
      requestJson<Payment[]>(`/api/invoices/${invoice.id}/payments`),
  });
  const schedule = useQuery({
    queryKey: ["invoice-payment-schedule", invoice.id],
    queryFn: () =>
      requestJson<PaymentInstallment[]>(
        `/api/invoices/${invoice.id}/payment-schedule`,
      ),
  });
  const record = useMutation({
    mutationFn: async (payload: PaymentInput) => {
      const storageName = `pastagansa:payment:${invoice.id}`;
      const key = paymentKey(invoice.id, sessionStorage.getItem(storageName));
      sessionStorage.setItem(storageName, key);
      const payment = await requestJson<Payment>(
        `/api/invoices/${invoice.id}/payments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, idempotencyKey: key }),
        },
      );
      sessionStorage.removeItem(storageName);
      return payment;
    },
    onSuccess: async (payment) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoice", invoice.id] }),
        queryClient.invalidateQueries({
          queryKey: ["invoice-payments", invoice.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["invoice-payment-schedule", invoice.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
      ]);
      setRecording(false);
      setNotice(
        `Cobro de ${formatMoney(payment.amount, payment.currency)} registrado.`,
      );
    },
  });
  const eligible = ["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(
    invoice.status,
  );

  return (
    <section className="payments-panel" aria-labelledby="payments-title">
      <header>
        <div>
          <p className="eyebrow">Tesorería</p>
          <h2 id="payments-title">Cobros</h2>
          <p>
            {schedule.data?.length
              ? nextInstallmentText(schedule.data, invoice.currency)
              : "Consultando vencimientos…"}
          </p>
        </div>
        {eligible && Number(invoice.amountDue) > 0 && (
          <button
            className="primary-button compact"
            onClick={() => setRecording(true)}
          >
            Registrar cobro
          </button>
        )}
      </header>
      {notice && (
        <div className="notice payment-notice" role="status">
          <span>✓</span>
          {notice}
          <button onClick={() => setNotice("")} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      )}
      {(payments.error || schedule.error) && (
        <div className="inline-error" role="alert">
          <strong>No se pudo cargar la información de cobros</strong>
          <p>{payments.error?.message ?? schedule.error?.message}</p>
        </div>
      )}
      {payments.isPending && <p className="dialog-helper">Cargando cobros…</p>}
      {payments.data?.length === 0 && (
        <div className="payments-empty">
          <strong>Sin cobros registrados</strong>
          <p>
            El saldo pendiente es{" "}
            {formatMoney(invoice.amountDue, invoice.currency)}.
          </p>
        </div>
      )}
      {!!payments.data?.length && (
        <div className="table-scroll">
          <table className="data-table payments-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Método</th>
                <th>Referencia</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {payments.data.map((payment) => (
                <tr key={payment.id}>
                  <td>{formatInvoiceDate(payment.paidAt)}</td>
                  <td>{paymentMethodLabel(payment.method)}</td>
                  <td>{payment.reference ?? "—"}</td>
                  <td className="money-cell">
                    {formatMoney(payment.amount, payment.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {recording && (
        <PaymentDialog
          invoice={invoice}
          pending={record.isPending}
          error={record.error?.message}
          onClose={() => {
            setRecording(false);
            record.reset();
          }}
          onSubmit={(payload) => record.mutate(payload)}
        />
      )}
    </section>
  );
}

function PaymentDialog({
  invoice,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  invoice: Invoice;
  pending: boolean;
  error?: string;
  onClose(): void;
  onSubmit(input: PaymentInput): void;
}) {
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onSubmit({
      amount: Number(values.get("amount")),
      paidAt: String(values.get("paidAt")),
      method: String(values.get("method")) as PaymentInput["method"],
      reference: String(values.get("reference") ?? "").trim() || undefined,
      notes: String(values.get("notes") ?? "").trim() || undefined,
    });
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <section
        className="dialog payment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
      >
        <header>
          <div>
            <p className="eyebrow">Nuevo movimiento</p>
            <h2 id="payment-title">Registrar cobro</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            disabled={pending}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>
        <form className="invoice-form" onSubmit={submit}>
          <div className="payment-balance">
            <span>Saldo pendiente</span>
            <strong>{formatMoney(invoice.amountDue, invoice.currency)}</strong>
          </div>
          <div className="payment-fields">
            <label className="field">
              <span>Importe</span>
              <input
                name="amount"
                type="number"
                required
                min="0.01"
                max={invoice.amountDue}
                step="0.01"
                defaultValue={Number(invoice.amountDue).toFixed(2)}
              />
            </label>
            <label className="field">
              <span>Fecha del cobro</span>
              <input
                name="paidAt"
                type="date"
                required
                defaultValue={todayIso()}
              />
            </label>
            <label className="field full">
              <span>Método</span>
              <select name="method" defaultValue="BANK_TRANSFER">
                <option value="BANK_TRANSFER">Transferencia</option>
                <option value="DIRECT_DEBIT">Domiciliación</option>
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
                <option value="OTHER">Otro</option>
              </select>
            </label>
            <label className="field full">
              <span>Referencia (opcional)</span>
              <input
                name="reference"
                maxLength={240}
                placeholder="Movimiento bancario, recibo…"
              />
            </label>
            <label className="field full">
              <span>Notas (opcional)</span>
              <textarea name="notes" rows={2} maxLength={1000} />
            </label>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={pending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-button compact"
              disabled={pending}
            >
              {pending ? "Registrando…" : "Confirmar cobro"}
            </button>
          </div>
        </form>
      </section>
    </div>
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

function nextInstallmentText(
  installments: PaymentInstallment[],
  currency: string,
) {
  const open = installments.find(
    (installment) => installment.status !== "PAID",
  );
  if (!open) return "Todos los vencimientos están cobrados.";
  const pending = Number(open.amount) - Number(open.paidAmount);
  return `Próximo vencimiento: ${formatInvoiceDate(open.dueDate)} · ${formatMoney(String(pending), currency)}`;
}
