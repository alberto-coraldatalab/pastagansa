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
          Empieza creando el cliente de tu primera factura.
        </p>
      </section>
      <section className="progress-card" aria-labelledby="progress-title">
        <div>
          <p className="eyebrow">Puesta en marcha</p>
          <h2 id="progress-title">Primer recorrido usable</h2>
        </div>
        <strong>1 de 4</strong>
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
        <Link className="next-card current card-link" href="/clientes">
          <span className="step-mark">2</span>
          <p>Crear cliente</p>
          <small>Ya disponible</small>
        </Link>
        <article className="next-card">
          <span className="step-mark">3</span>
          <p>Preparar factura</p>
          <small>Líneas, IVA y vencimiento</small>
        </article>
        <article className="next-card">
          <span className="step-mark">4</span>
          <p>Emitir y descargar</p>
          <small>Numeración y PDF oficial</small>
        </article>
      </section>
    </AppShell>
  );
}
