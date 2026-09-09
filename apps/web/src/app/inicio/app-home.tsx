"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export function AppHome() {
  return (
    <AppShell active="inicio">
      <section className="welcome">
        <p className="eyebrow">Espacio de trabajo activo</p>
        <h1>Hola, ya tienes la base preparada.</h1>
        <p>
          Tu sesión y el contexto de empresa están conectados de forma segura.
          Ya puedes completar la venta: crear clientes, preparar una factura,
          emitirla, descargar su PDF y registrar cobros parciales o totales.
        </p>
      </section>
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
      </section>
    </AppShell>
  );
}
