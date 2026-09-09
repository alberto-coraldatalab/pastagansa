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
          Ya puedes crear clientes, preparar una factura, emitirla y descargar
          su PDF oficial. El siguiente paso del producto será registrar su
          cobro.
        </p>
      </section>
      <section className="progress-card" aria-labelledby="progress-title">
        <div>
          <p className="eyebrow">Puesta en marcha</p>
          <h2 id="progress-title">Primer recorrido usable</h2>
        </div>
        <strong>3 de 4</strong>
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
        <article className="next-card current">
          <span className="step-mark">4</span>
          <p>Registrar cobro</p>
          <small>Próximo slice</small>
        </article>
      </section>
    </AppShell>
  );
}
