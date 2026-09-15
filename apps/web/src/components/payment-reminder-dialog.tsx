"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

export type ReminderTarget = { id: string; number: string };
type ReminderTemplate = "DUE_SOON" | "OVERDUE_FIRST" | "OVERDUE_SECOND";
type PreviewItem = {
  invoiceId: string;
  status: "READY" | "SKIPPED";
  reason: string | null;
  recipient: string | null;
  subject: string | null;
  body: string | null;
  invoice: { id: string; number: string | null; amountDue: string; currency: string; dueDate: string | null; disputed?: boolean } | null;
};
type PreviewResponse = { items: PreviewItem[]; summary: { ready: number; skipped: number; recipients: number } };

const templateLabels: Record<ReminderTemplate, string> = {
  DUE_SOON: "Próximo vencimiento",
  OVERDUE_FIRST: "Primer aviso de vencida",
  OVERDUE_SECOND: "Segundo aviso de vencida",
};

export function PaymentReminderDialog({ targets, mode = "batch", onClose, onQueued }: { targets: ReminderTarget[]; mode?: "single" | "batch"; onClose(): void; onQueued(result: { queued: number; skipped: number }): void }) {
  const [template, setTemplate] = useState<ReminderTemplate>("OVERDUE_FIRST");
  const targetKey = useMemo(() => targets.map((target) => target.id).sort().join(","), [targets]);
  const storageKey = `pastagansa:payment-reminder:${mode}:${targetKey}:${template}`;
  const preview = useQuery({
    queryKey: ["payment-reminder-preview", mode, targetKey, template],
    queryFn: () => preparePreview(targets, template, mode),
    enabled: targets.length > 0,
  });
  const send = useMutation({
    mutationFn: async () => {
      const idempotencyKey = sessionStorage.getItem(storageKey) ?? `reminder-${crypto.randomUUID()}`;
      sessionStorage.setItem(storageKey, idempotencyKey);
      return sendReminder(targets, template, mode, idempotencyKey);
    },
    onSuccess: (result) => {
      sessionStorage.removeItem(storageKey);
      onQueued(result);
    },
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !send.isPending) onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [onClose, send.isPending]);

  const items = preview.data?.items ?? [];
  const ready = items.filter((item) => item.status === "READY");
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !send.isPending) onClose(); }}>
      <section className="dialog reminder-dialog" role="dialog" aria-modal="true" aria-labelledby="reminder-title">
        <header>
          <div>
            <p className="eyebrow">Cobros · revisión antes de enviar</p>
            <h2 id="reminder-title">Preparar {targets.length === 1 ? "recordatorio" : `${targets.length} recordatorios`}</h2>
          </div>
          <button className="icon-button" onClick={onClose} disabled={send.isPending} aria-label="Cerrar">×</button>
        </header>
        <label className="field">
          <span>Plantilla</span>
          <select value={template} onChange={(event) => setTemplate(event.target.value as ReminderTemplate)} disabled={send.isPending}>
            {Object.entries(templateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <p className="dialog-helper">Se muestra el destinatario, asunto y texto exactos. Los envíos masivos excluyen facturas pagadas, sin saldo y en disputa.</p>
        {preview.isPending && <p className="dialog-helper">Preparando vista previa…</p>}
        {preview.error && <p className="form-error" role="alert">{preview.error.message}</p>}
        {!!items.length && <div className="reminder-preview-list">
          {items.map((item) => <article key={item.invoiceId} className={item.status === "SKIPPED" ? "reminder-skipped" : ""}>
            <header><strong>{item.invoice?.number ?? targets.find((target) => target.id === item.invoiceId)?.number ?? "Factura"}</strong><span>{item.status === "READY" ? item.recipient : "Excluida"}</span></header>
            {item.status === "SKIPPED" ? <p>{item.reason}</p> : <><p><strong>Asunto:</strong> {item.subject}</p><pre>{item.body}</pre></>}
          </article>)}
        </div>}
        {send.error && <p className="form-error" role="alert">{send.error.message}</p>}
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={send.isPending}>Cancelar</button>
          <button type="button" className="primary-button compact" onClick={() => send.mutate()} disabled={!ready.length || preview.isPending || send.isPending}>{send.isPending ? "Enviando…" : `Enviar ${ready.length} recordatorio${ready.length === 1 ? "" : "s"}`}</button>
        </div>
      </section>
    </div>
  );
}

async function preparePreview(targets: ReminderTarget[], template: ReminderTemplate, mode: "single" | "batch"): Promise<PreviewResponse> {
  if (mode === "single") {
    const response = await requestJson<PreviewItem & { eligible: boolean }>(`/api/invoices/${targets[0].id}/payment-reminder/preview`, { method: "POST", body: JSON.stringify({ template }) });
    return { items: [{ ...response, status: response.eligible ? "READY" : "SKIPPED" }], summary: { ready: response.eligible ? 1 : 0, skipped: response.eligible ? 0 : 1, recipients: response.recipient ? 1 : 0 } };
  }
  return requestJson<PreviewResponse>("/api/collections/reminders/preview", { method: "POST", body: JSON.stringify({ template, invoiceIds: targets.map((target) => target.id) }) });
}

async function sendReminder(targets: ReminderTarget[], template: ReminderTemplate, mode: "single" | "batch", idempotencyKey: string) {
  if (mode === "single") {
    await requestJson(`/api/invoices/${targets[0].id}/payment-reminder`, { method: "POST", body: JSON.stringify({ template, idempotencyKey }) });
    return { queued: 1, skipped: 0 };
  }
  const response = await requestJson<{ summary: { queued: number; skipped: number } }>("/api/collections/reminders", { method: "POST", body: JSON.stringify({ template, invoiceIds: targets.map((target) => target.id), idempotencyKey }) });
  return response.summary;
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init.headers } });
  const body = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "No se pudo preparar el recordatorio.");
  return body as T;
}
