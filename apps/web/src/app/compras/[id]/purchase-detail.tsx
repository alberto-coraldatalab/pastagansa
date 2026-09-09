"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { formatMoney } from "@/lib/catalog";
import {
  formatInvoiceDate,
  paymentMethodLabel,
  todayIso,
  type DocumentSequence,
  type PaymentInput,
} from "@/lib/invoices";
import {
  approvalKey,
  purchaseStatusLabel,
  supplierPaymentKey,
  type Purchase,
  type PurchaseInput,
  type PurchaseTrace,
  type SupplierPayment,
} from "@/lib/purchases";
import { PurchaseDialog } from "../purchases-view";

export function PurchaseDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [notice, setNotice] = useState("");
  const purchase = useQuery({
    queryKey: ["purchase", id],
    queryFn: () => requestJson<Purchase>(`/api/purchases/${id}`),
    retry: false,
  });
  const update = useMutation({
    mutationFn: (payload: PurchaseInput) =>
      requestJson<Purchase>(`/api/purchases/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(["purchase", id], updated);
      await queryClient.invalidateQueries({ queryKey: ["purchases"] });
      setEditing(false);
      setNotice("Los cambios del borrador se han guardado.");
    },
  });

  if (purchase.isPending)
    return (
      <AppShell active="compras">
        <section className="detail-loading">
          <div className="spinner" />
          <p>Cargando compra…</p>
        </section>
      </AppShell>
    );
  if (purchase.error)
    return (
      <AppShell active="compras">
        <section className="detail-error">
          <p className="eyebrow">No se pudo abrir</p>
          <h1>Compra no disponible</h1>
          <p>{purchase.error.message}</p>
          <Link className="primary-link" href="/compras">
            Volver a compras
          </Link>
        </section>
      </AppShell>
    );

  const document = purchase.data;
  return (
    <AppShell active="compras">
      <section className="detail-heading">
        <div>
          <Link className="back-link" href="/compras">
            ← Compras
          </Link>
          <p className="eyebrow">
            Factura recibida · {document.supplierInvoiceNumber}
          </p>
          <h1>{document.receptionFullNumber ?? "Compra en borrador"}</h1>
          <p>{document.supplierLegalName}</p>
        </div>
        <div className="detail-actions">
          {document.status === "DRAFT" && (
            <>
              <button
                className="secondary-button"
                onClick={() => setEditing(true)}
              >
                Editar borrador
              </button>
              <button
                className="primary-button compact"
                onClick={() => setApproving(true)}
              >
                Aprobar compra
              </button>
            </>
          )}
          {document.status === "APPROVED" && (
            <a className="secondary-button trace-link" href="#trazabilidad">
              Ver trazabilidad
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
          <strong>{purchaseStatusLabel(document.status)}</strong>
        </article>
        <article className="summary-card">
          <span>Factura proveedor</span>
          <strong>{document.supplierInvoiceNumber}</strong>
        </article>
        <article className="summary-card">
          <span>Recepción</span>
          <strong>{formatInvoiceDate(document.receivedDate)}</strong>
        </article>
        <article className="summary-card total-card">
          <span>Total</span>
          <strong>{formatMoney(document.total, document.currency)}</strong>
        </article>
        <article className="summary-card">
          <span>Pagado</span>
          <strong>{formatMoney(document.amountPaid, document.currency)}</strong>
        </article>
        <article className="summary-card due-card">
          <span>Pendiente</span>
          <strong>{formatMoney(document.amountDue, document.currency)}</strong>
        </article>
      </section>
      {document.status === "APPROVED" && <PaymentsPanel purchase={document} />}
      <section className="invoice-detail-panel">
        <header>
          <h2>Conceptos</h2>
          <p>{document.lines?.length ?? 0} líneas confirmadas por el API</p>
        </header>
        <div className="table-scroll">
          <table className="data-table invoice-lines-table">
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>IVA</th>
                <th>Deducible</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {document.lines?.map((line) => (
                <tr key={line.id}>
                  <td>
                    <strong>{line.description}</strong>
                  </td>
                  <td>{Number(line.quantity).toLocaleString("es-ES")}</td>
                  <td className="money-cell">
                    {formatMoney(line.unitPrice, document.currency)}
                  </td>
                  <td>{Number(line.taxLines[0]?.taxRate ?? 0)} %</td>
                  <td>{Number(line.taxLines[0]?.deductiblePct ?? 0)} %</td>
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
            Base{" "}
            <strong>
              {formatMoney(
                String(
                  Number(document.subtotal) - Number(document.discountTotal),
                ),
                document.currency,
              )}
            </strong>
          </span>
          <span>
            IVA soportado{" "}
            <strong>{formatMoney(document.taxTotal, document.currency)}</strong>
          </span>
          <span>
            IVA deducible{" "}
            <strong>
              {formatMoney(document.deductibleTaxTotal, document.currency)}
            </strong>
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
      {document.status === "APPROVED" && <TracePanel purchase={document} />}
      {editing && (
        <PurchaseDialog
          initial={document}
          pending={update.isPending}
          error={update.error?.message}
          onClose={() => {
            setEditing(false);
            update.reset();
          }}
          onSubmit={(payload) => update.mutate(payload)}
        />
      )}
      {approving && (
        <ApprovalDialog
          purchase={document}
          onClose={() => setApproving(false)}
          onApproved={async (approved) => {
            queryClient.setQueryData(["purchase", id], approved);
            await queryClient.invalidateQueries({ queryKey: ["purchases"] });
            setApproving(false);
            setNotice(
              `${approved.receptionFullNumber ?? "La compra"} se ha aprobado correctamente.`,
            );
          }}
        />
      )}
    </AppShell>
  );
}

function ApprovalDialog({
  purchase,
  onClose,
  onApproved,
}: {
  purchase: Purchase;
  onClose(): void;
  onApproved(purchase: Purchase): Promise<void>;
}) {
  const sequences = useQuery({
    queryKey: ["document-sequences"],
    queryFn: () => requestJson<DocumentSequence[]>("/api/document-sequences"),
  });
  const approve = useMutation({
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
            body: JSON.stringify({ documentType: "PURCHASE_INVOICE", series }),
          },
        );
        selectedId = created.id;
      }
      const storageName = `pastagansa:approve:${purchase.id}`;
      const key = approvalKey(purchase.id, sessionStorage.getItem(storageName));
      sessionStorage.setItem(storageName, key);
      const result = await requestJson<Purchase>(
        `/api/purchases/${purchase.id}/approve`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sequenceId: selectedId, idempotencyKey: key }),
        },
      );
      sessionStorage.removeItem(storageName);
      return result;
    },
    onSuccess: onApproved,
  });
  const active =
    sequences.data?.filter(
      (sequence) =>
        sequence.active && sequence.documentType === "PURCHASE_INVOICE",
    ) ?? [];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    approve.mutate({
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
        aria-labelledby="approval-title"
      >
        <header>
          <div>
            <p className="eyebrow">Confirmación</p>
            <h2 id="approval-title">Aprobar compra</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            disabled={approve.isPending}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>
        <form className="invoice-form" onSubmit={submit}>
          <p className="issue-warning">
            Al aprobar se congelan los importes, se asigna el registro de
            recepción y se generan el asiento y el libro de IVA.
          </p>
          <div className="issue-amount">
            <span>Total a aprobar</span>
            <strong>{formatMoney(purchase.total, purchase.currency)}</strong>
          </div>
          {active.length > 0 ? (
            <label className="field">
              <span>Serie de recepción</span>
              <select name="sequenceId" required defaultValue="">
                <option value="" disabled>
                  Selecciona una serie
                </option>
                {active.map((sequence) => (
                  <option key={sequence.id} value={sequence.id}>
                    {sequence.series}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field">
              <span>Nueva serie de recepción</span>
              <input name="series" required maxLength={30} placeholder="RC" />
            </label>
          )}
          {sequences.error && (
            <p className="form-error">{sequences.error.message}</p>
          )}
          {approve.error && (
            <p className="form-error" role="alert">
              {approve.error.message}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={approve.isPending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-button compact"
              disabled={approve.isPending || sequences.isPending}
            >
              {approve.isPending ? "Aprobando…" : "Aprobar definitivamente"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PaymentsPanel({ purchase }: { purchase: Purchase }) {
  const queryClient = useQueryClient();
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState("");
  const payments = useQuery({
    queryKey: ["purchase-payments", purchase.id],
    queryFn: () =>
      requestJson<SupplierPayment[]>(`/api/purchases/${purchase.id}/payments`),
  });
  const record = useMutation({
    mutationFn: async (payload: PaymentInput) => {
      const storageName = `pastagansa:supplier-payment:${purchase.id}`;
      const key = supplierPaymentKey(
        purchase.id,
        sessionStorage.getItem(storageName),
      );
      sessionStorage.setItem(storageName, key);
      const result = await requestJson<SupplierPayment>(
        `/api/purchases/${purchase.id}/payments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, idempotencyKey: key }),
        },
      );
      sessionStorage.removeItem(storageName);
      return result;
    },
    onSuccess: async (payment) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["purchase", purchase.id] }),
        queryClient.invalidateQueries({
          queryKey: ["purchase-payments", purchase.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["purchases"] }),
      ]);
      setRecording(false);
      setNotice(
        `Pago de ${formatMoney(payment.amount, payment.currency)} registrado.`,
      );
    },
  });
  return (
    <section
      className="payments-panel"
      aria-labelledby="supplier-payments-title"
    >
      <header>
        <div>
          <p className="eyebrow">Tesorería</p>
          <h2 id="supplier-payments-title">Pagos</h2>
          <p>
            Saldo pendiente:{" "}
            {formatMoney(purchase.amountDue, purchase.currency)}
          </p>
        </div>
        {Number(purchase.amountDue) > 0 && (
          <button
            className="primary-button compact"
            onClick={() => setRecording(true)}
          >
            Registrar pago
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
      {payments.error && (
        <div className="inline-error" role="alert">
          <strong>No se pudieron cargar los pagos</strong>
          <p>{payments.error.message}</p>
        </div>
      )}
      {payments.isPending && <p className="dialog-helper">Cargando pagos…</p>}
      {payments.data?.length === 0 && (
        <div className="payments-empty">
          <strong>Sin pagos registrados</strong>
          <p>Registra el pago cuando salga de tu cuenta.</p>
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
          purchase={purchase}
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
  purchase,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  purchase: Purchase;
  pending: boolean;
  error?: string;
  onClose(): void;
  onSubmit(input: PaymentInput): void;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onSubmit({
      amount: Number(values.get("amount")),
      paidAt: String(values.get("paidAt")),
      method: String(values.get("method")) as PaymentInput["method"],
      reference: String(values.get("reference") ?? "").trim() || undefined,
    });
  }
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="dialog payment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-payment-title"
      >
        <header>
          <div>
            <p className="eyebrow">Salida de tesorería</p>
            <h2 id="supplier-payment-title">Registrar pago</h2>
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
            <strong>
              {formatMoney(purchase.amountDue, purchase.currency)}
            </strong>
          </div>
          <div className="payment-fields">
            <label className="field">
              <span>Importe</span>
              <input
                name="amount"
                type="number"
                required
                min="0.01"
                max={purchase.amountDue}
                step="0.01"
                defaultValue={Number(purchase.amountDue).toFixed(2)}
              />
            </label>
            <label className="field">
              <span>Fecha del pago</span>
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
              <input name="reference" maxLength={240} />
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
              {pending ? "Registrando…" : "Confirmar pago"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function TracePanel({ purchase }: { purchase: Purchase }) {
  const trace = useQuery({
    queryKey: ["purchase-trace", purchase.id],
    queryFn: () =>
      requestJson<PurchaseTrace>(`/api/purchases/${purchase.id}/trace`),
  });
  const sum = (values: object[], field: string) =>
    String(
      values.reduce(
        (total, value) =>
          total + Number((value as Record<string, string>)[field]),
        0,
      ),
    );
  return (
    <section
      className="trace-panel"
      id="trazabilidad"
      aria-labelledby="purchase-trace-title"
    >
      <header>
        <p className="eyebrow">Trazabilidad</p>
        <h2 id="purchase-trace-title">Impacto fiscal y contable</h2>
        <p>Registros generados automáticamente al aprobar.</p>
      </header>
      {trace.isPending && (
        <p className="dialog-helper">Cargando trazabilidad…</p>
      )}
      {trace.error && <p className="form-error">{trace.error.message}</p>}
      {trace.data && (
        <div className="trace-grid">
          <article>
            <span>Asiento contable</span>
            {trace.data.journalEntry ? (
              <>
                <strong>Asiento #{trace.data.journalEntry.entryNumber}</strong>
                <small>{trace.data.journalEntry.description}</small>
                <dl>
                  <div>
                    <dt>Debe</dt>
                    <dd>
                      {formatMoney(
                        sum(trace.data.journalEntry.lines, "debit"),
                        purchase.currency,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Haber</dt>
                    <dd>
                      {formatMoney(
                        sum(trace.data.journalEntry.lines, "credit"),
                        purchase.currency,
                      )}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <strong>No encontrado</strong>
            )}
          </article>
          <article>
            <span>Libro de IVA recibido</span>
            {trace.data.taxEntry ? (
              <>
                <strong>{trace.data.taxEntry.documentNumber}</strong>
                <small>
                  {formatInvoiceDate(trace.data.taxEntry.taxPointDate)}
                </small>
                <dl>
                  <div>
                    <dt>Base</dt>
                    <dd>
                      {formatMoney(
                        sum(trace.data.taxEntry.amounts, "taxableBase"),
                        purchase.currency,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Cuota</dt>
                    <dd>
                      {formatMoney(
                        sum(trace.data.taxEntry.amounts, "taxAmount"),
                        purchase.currency,
                      )}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <strong>No encontrado</strong>
            )}
          </article>
        </div>
      )}
    </section>
  );
}

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(body.error ?? "No se pudo completar la operación.");
  return body;
}
