"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";

type CommercialEventType = "SENT" | "DELIVERY_FAILED" | "ACCEPTED" | "REJECTED" | "DISPUTED" | "PARTIALLY_PAID" | "PAID" | "PAYMENT_PROMISED";
type CommercialEvent = { id: string; type: CommercialEventType; source: string; effectiveAt: string; receivedAt: string; comment: string | null };
type Page = { data: CommercialEvent[]; nextCursor: string | null };

const labels: Record<CommercialEventType, string> = {
  SENT: "Enviado", DELIVERY_FAILED: "Entrega fallida", ACCEPTED: "Aceptado", REJECTED: "Rechazado",
  DISPUTED: "En disputa", PARTIALLY_PAID: "Cobro parcial", PAID: "Cobrado", PAYMENT_PROMISED: "Promesa de pago",
};

export function CommercialTimeline({ endpoint, canManage }: { endpoint: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<"ACCEPTED" | "REJECTED" | "DISPUTED" | "PAYMENT_PROMISED">("ACCEPTED");
  const [comment, setComment] = useState("");
  const events = useQuery({ queryKey: ["commercial-events", endpoint], queryFn: () => requestJson<Page>(endpoint) });
  const record = useMutation({
    mutationFn: () => requestJson<CommercialEvent>(endpoint, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, source: "USER", effectiveAt: new Date().toISOString(), comment: comment || undefined }),
    }),
    onSuccess: async () => { setComment(""); await queryClient.invalidateQueries({ queryKey: ["commercial-events", endpoint] }); },
  });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); record.mutate(); }
  return <section className="invoice-detail-panel" aria-labelledby="commercial-timeline-title">
    <header><div><h2 id="commercial-timeline-title">Cronología comercial</h2><p>Registro inalterable de entrega, respuesta y cobro.</p></div></header>
    {events.isPending ? <p>Cargando cronología…</p> : events.error ? <p className="form-error" role="alert">{events.error.message}</p> : events.data?.data.length ? <ol className="payment-list">{events.data.data.map((event) => <li key={event.id}><div><strong>{labels[event.type]}</strong><span>{formatDate(event.effectiveAt)} · {event.source}</span>{event.comment && <small>{event.comment}</small>}</div></li>)}</ol> : <p className="empty-state">Aún no hay eventos comerciales.</p>}
    {canManage && <form className="contact-form" onSubmit={submit}>
      <label className="field"><span>Registrar evento</span><select value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="ACCEPTED">Aceptación</option><option value="REJECTED">Rechazo</option><option value="DISPUTED">Disputa</option><option value="PAYMENT_PROMISED">Promesa de pago</option></select></label>
      <label className="field"><span>Comentario</span><input maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
      <div className="full"><button className="secondary-button" disabled={record.isPending} type="submit">{record.isPending ? "Registrando…" : "Añadir a la cronología"}</button></div>
    </form>}
    {record.error && <p className="form-error" role="alert">{record.error.message}</p>}
  </section>;
}

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  const body = await response.json().catch(() => undefined) as T & { error?: string };
  if (!response.ok) throw new Error(body?.error ?? "No se pudo completar la operación.");
  return body;
}
function formatDate(value: string) { return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
