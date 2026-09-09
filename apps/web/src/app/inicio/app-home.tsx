"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SessionView {
  user: { id: string; email: string };
  membership: {
    organization: { id: string; name: string };
    company: {
      id: string;
      legalName: string;
      taxId: string;
      baseCurrency: string;
    };
    role: { code: string; name: string; permissions: string[] };
  };
}

export function AppHome() {
  const router = useRouter();
  const [session, setSession] = useState<SessionView>();
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/acceso");
          return;
        }
        const body = (await response.json()) as SessionView & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(body.error ?? "No se pudo cargar la sesión.");
        setSession(body);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "No se pudo cargar la sesión.",
        ),
      );
  }, [router]);

  if (error)
    return (
      <main className="center-state">
        <p className="eyebrow">No hemos podido entrar</p>
        <h1>Hay un problema con tu sesión</h1>
        <p>{error}</p>
        <Link className="primary-link" href="/acceso">
          Volver al acceso
        </Link>
      </main>
    );
  if (!session)
    return (
      <main className="center-state" aria-live="polite">
        <div className="spinner" />
        <p>Preparando tu empresa…</p>
      </main>
    );

  const { company, organization } = session.membership;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="wordmark" href="/inicio">
          PastaGansa
        </Link>
        <nav aria-label="Navegación principal">
          <Link className="nav-item active" href="/inicio">
            <span>01</span>Inicio
          </Link>
          <span className="nav-item disabled">
            <span>02</span>Ventas <small>Próximo</small>
          </span>
          <span className="nav-item disabled">
            <span>03</span>Compras
          </span>
          <span className="nav-item disabled">
            <span>04</span>Contabilidad
          </span>
        </nav>
        <div className="sidebar-company">
          <span>{organization.name}</span>
          <strong>{company.legalName}</strong>
          <small>{company.taxId}</small>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="company-pill">
            <span className="status-dot" />
            {company.legalName}
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="text-button" type="submit">
              Cerrar sesión
            </button>
          </form>
        </header>
        <section className="welcome">
          <p className="eyebrow">Espacio de trabajo activo</p>
          <h1>Hola, ya tienes la base preparada.</h1>
          <p>
            Tu sesión y el contexto de empresa están conectados de forma segura.
            El siguiente paso será emitir tu primera factura.
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
          <article className="next-card current">
            <span className="step-mark">2</span>
            <p>Crear cliente</p>
            <small>Disponible en el siguiente slice</small>
          </article>
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
        <footer className="workspace-footer">
          {session.user.email} · {company.baseCurrency}
        </footer>
      </main>
    </div>
  );
}
