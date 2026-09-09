"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { formatMoney } from "@/lib/catalog";

interface DashboardSummary {
  currency: string;
  sales: { count: number };
  purchases: { count: number };
  receivable: { count: number; amount: string };
  payable: { count: number; amount: string };
}

export function AppHome() {
  const summary = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const body = (await response.json()) as DashboardSummary & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error ?? "No se pudo cargar el resumen.");
      return body;
    },
  });
  return (
    <AppShell active="inicio">
      <section className="welcome">
        <p className="eyebrow">Espacio de trabajo activo</p>
        <h1>Hola, ya tienes la base preparada.</h1>
        <p>
          Tu sesión y el contexto de empresa están conectados de forma segura.
          Ya puedes completar la venta y también registrar una factura de
          proveedor, aprobarla y pagarla con su contabilidad conectada.
        </p>
      </section>
      <section className="dashboard-grid" aria-label="Resumen del negocio">
        <article>
          <span>Ventas emitidas</span>
          <strong>{summary.data?.sales.count ?? "—"}</strong>
          <Link href="/facturas">Ver facturas</Link>
        </article>
        <article>
          <span>Pendiente de cobro</span>
          <strong>
            {summary.data
              ? formatMoney(
                  summary.data.receivable.amount,
                  summary.data.currency,
                )
              : "—"}
          </strong>
          <small>{summary.data?.receivable.count ?? "—"} documentos</small>
        </article>
        <article>
          <span>Compras aprobadas</span>
          <strong>{summary.data?.purchases.count ?? "—"}</strong>
          <Link href="/compras">Ver compras</Link>
        </article>
        <article>
          <span>Pendiente de pago</span>
          <strong>
            {summary.data
              ? formatMoney(summary.data.payable.amount, summary.data.currency)
              : "—"}
          </strong>
          <small>{summary.data?.payable.count ?? "—"} documentos</small>
        </article>
      </section>
      {summary.error && (
        <p className="form-error" role="alert">
          {summary.error.message}
        </p>
      )}
      <section className="progress-card" aria-labelledby="progress-title">
        <div>
          <p className="eyebrow">Puesta en marcha</p>
          <h2 id="progress-title">Primer recorrido usable</h2>
        </div>
        <strong>4 de 4</strong>
        <div className="progress-track">
          <span />
        </div>
      </section>
      <section className="next-grid">
        <article className="next-card done">
          <span className="step-mark">✓</span>
          <p>Acceso seguro</p>
          <small>Sesión y empresa activa</small>
        </article>
        <Link className="next-card done card-link" href="/clientes">
          <span className="step-mark">✓</span>
          <p>Crear cliente y servicio</p>
          <small>Maestros ya disponibles</small>
        </Link>
        <Link className="next-card done card-link" href="/facturas">
          <span className="step-mark">✓</span>
          <p>Preparar y emitir</p>
          <small>Detalle y PDF disponibles</small>
        </Link>
        <Link className="next-card done card-link" href="/facturas">
          <span className="step-mark">✓</span>
          <p>Registrar cobro</p>
          <small>Saldo e historial disponibles</small>
        </Link>
        <Link className="next-card done card-link" href="/compras">
          <span className="step-mark">→</span>
          <p>Registrar una compra</p>
          <small>Aprobación, pago y trazabilidad</small>
        </Link>
      </section>
    </AppShell>
  );
}
