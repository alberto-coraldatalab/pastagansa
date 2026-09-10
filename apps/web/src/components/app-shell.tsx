"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ActiveMembership = {
  organization: { id: string; name: string };
  company: {
    id: string;
    legalName: string;
    taxId: string;
    baseCurrency: string;
  };
  role: { code: string; name: string; permissions: string[] };
};

export interface SessionView {
  user: { id: string; email: string };
  membership: ActiveMembership;
  memberships: ActiveMembership[];
}

export function AppShell({
  active,
  children,
}: {
  active:
    | "inicio"
    | "clientes"
    | "catalogo"
    | "facturas"
    | "compras"
    | "tesoreria"
    | "contabilidad";
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [switchingCompany, setSwitchingCompany] = useState(false);
  const [switchError, setSwitchError] = useState<string>();
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
  async function switchCompany(companyId: string) {
    const next = session.data!.memberships.find(
      (membership) => membership.company.id === companyId,
    );
    if (!next || next.company.id === company.id) return;
    setSwitchingCompany(true);
    setSwitchError(undefined);
    const response = await fetch("/api/auth/tenant", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId: next.organization.id,
        companyId: next.company.id,
      }),
    });
    const body = (await response.json().catch(() => undefined)) as
      { error?: string } | undefined;
    if (!response.ok) {
      setSwitchError(body?.error ?? "No se pudo cambiar de empresa.");
      setSwitchingCompany(false);
      return;
    }
    window.location.reload();
  }
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
          <NavLink active={active === "catalogo"} href="/catalogo" number="03">
            Catálogo
          </NavLink>
          <NavLink active={active === "facturas"} href="/facturas" number="04">
            Facturas
          </NavLink>
          <NavLink active={active === "compras"} href="/compras" number="05">
            Compras
          </NavLink>
          <NavLink
            active={active === "tesoreria"}
            href="/tesoreria"
            number="06"
          >
            Tesorería
          </NavLink>
          <NavLink
            active={active === "contabilidad"}
            href="/contabilidad"
            number="07"
          >
            Contabilidad
          </NavLink>
        </nav>
        <div className="sidebar-company">
          <span>{organization.name}</span>
          <strong>{company.legalName}</strong>
          <small>{company.taxId}</small>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          {session.data.memberships.length > 1 ? (
            <label className="company-switcher">
              <span>Empresa activa</span>
              <select
                aria-describedby={
                  switchError ? "company-switch-error" : undefined
                }
                disabled={switchingCompany}
                onChange={(event) => void switchCompany(event.target.value)}
                value={company.id}
              >
                {session.data.memberships.map((membership) => (
                  <option
                    key={`${membership.organization.id}:${membership.company.id}`}
                    value={membership.company.id}
                  >
                    {membership.company.legalName} ·{" "}
                    {membership.organization.name}
                  </option>
                ))}
              </select>
              {switchError ? (
                <small id="company-switch-error" role="alert">
                  {switchError}
                </small>
              ) : null}
            </label>
          ) : (
            <div className="company-pill">
              <span className="status-dot" />
              {company.legalName}
            </div>
          )}
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
  href:
    | "/inicio"
    | "/clientes"
    | "/catalogo"
    | "/facturas"
    | "/compras"
    | "/tesoreria"
    | "/contabilidad";
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
