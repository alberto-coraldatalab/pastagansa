"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export interface SessionView {
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

export function AppShell({
  active,
  children,
}: {
  active: "inicio" | "clientes";
  children: React.ReactNode;
}) {
  const router = useRouter();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (response.status === 401) throw new UnauthorizedError();
      const body = (await response.json()) as SessionView & { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "No se pudo cargar la sesión.");
      return body;
    },
    retry: false,
  });

  useEffect(() => {
    if (session.error instanceof UnauthorizedError) router.replace("/acceso");
  }, [router, session.error]);

  if (session.error && !(session.error instanceof UnauthorizedError))
    return (
      <main className="center-state">
        <p className="eyebrow">No hemos podido entrar</p>
        <h1>Hay un problema con tu sesión</h1>
        <p>{session.error.message}</p>
        <Link className="primary-link" href="/acceso">
          Volver al acceso
        </Link>
      </main>
    );
  if (!session.data)
    return (
      <main className="center-state" aria-live="polite">
        <div className="spinner" />
        <p>Preparando tu empresa…</p>
      </main>
    );

  const { company, organization } = session.data.membership;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="wordmark" href="/inicio">
          PastaGansa
        </Link>
        <nav aria-label="Navegación principal">
          <NavLink active={active === "inicio"} href="/inicio" number="01">
            Inicio
          </NavLink>
          <NavLink active={active === "clientes"} href="/clientes" number="02">
            Clientes
          </NavLink>
          <span className="nav-item disabled">
            <span>03</span>Facturas <small>Próximo</small>
          </span>
          <span className="nav-item disabled">
            <span>04</span>Compras
          </span>
          <span className="nav-item disabled">
            <span>05</span>Contabilidad
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
        {children}
        <footer className="workspace-footer">
          {session.data.user.email} · {company.baseCurrency}
        </footer>
      </main>
    </div>
  );
}

function NavLink({
  active,
  href,
  number,
  children,
}: {
  active: boolean;
  href: "/inicio" | "/clientes";
  number: string;
  children: React.ReactNode;
}) {
  return (
    <Link className={`nav-item${active ? " active" : ""}`} href={href}>
      <span>{number}</span>
      {children}
    </Link>
  );
}

class UnauthorizedError extends Error {}
