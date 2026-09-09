"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { contactPayload, type Contact, type ContactPage } from "@/lib/contacts";

export function ContactsView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<(string | undefined)[]>([]);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");

  const contacts = useQuery({
    queryKey: ["contacts", search, cursor],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "20", kind: "CUSTOMER" });
      if (search) params.set("search", search);
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/contacts?${params}`);
      const body = (await response.json()) as ContactPage & { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "No se pudieron cargar los clientes.");
      return body;
    },
  });

  const createContact = useMutation({
    mutationFn: async (payload: ReturnType<typeof contactPayload>) => {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as Contact & { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "No se pudo guardar el cliente.");
      return body;
    },
    onSuccess: async (contact) => {
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setCreating(false);
      setNotice(`${contact.legalName} ya está en tu cartera de clientes.`);
    },
  });

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setCursor(undefined);
    setHistory([]);
    setNotice("");
  }

  return (
    <AppShell active="clientes">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Ventas · Maestros</p>
          <h1>Clientes</h1>
          <p>
            La información que quedará reflejada en presupuestos y facturas.
          </p>
        </div>
        <button
          className="primary-button compact"
          onClick={() => setCreating(true)}
        >
          Nuevo cliente
        </button>
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

      <section className="data-panel" aria-labelledby="contacts-title">
        <div className="data-toolbar">
          <div>
            <h2 id="contacts-title">Cartera activa</h2>
            <p>
              {contacts.data
                ? `${contacts.data.data.length} en esta página`
                : "Cargando…"}
            </p>
          </div>
          <form className="search-form" onSubmit={applySearch} role="search">
            <label className="sr-only" htmlFor="contact-search">
              Buscar clientes
            </label>
            <input
              id="contact-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nombre, razón social o NIF"
              maxLength={100}
            />
            <button type="submit">Buscar</button>
          </form>
        </div>

        {contacts.isPending && <LoadingRows />}
        {contacts.error && (
          <div className="inline-error" role="alert">
            <strong>No se pudo cargar la cartera</strong>
            <p>{contacts.error.message}</p>
            <button onClick={() => void contacts.refetch()}>Reintentar</button>
          </div>
        )}
        {contacts.data?.data.length === 0 && (
          <div className="empty-state">
            <span>CL</span>
            <h3>
              {search ? "No hay coincidencias" : "Crea tu primer cliente"}
            </h3>
            <p>
              {search
                ? "Prueba con otro nombre o NIF."
                : "Después podrás seleccionarlo al preparar una factura."}
            </p>
            {!search && (
              <button
                className="secondary-button"
                onClick={() => setCreating(true)}
              >
                Nuevo cliente
              </button>
            )}
          </div>
        )}
        {!!contacts.data?.data.length && (
          <ContactsTable contacts={contacts.data.data} />
        )}

        {(history.length > 0 || contacts.data?.nextCursor) && (
          <div className="pagination" aria-label="Paginación de clientes">
            <button
              disabled={!history.length}
              onClick={() => {
                const previous = history.at(-1);
                setHistory((items) => items.slice(0, -1));
                setCursor(previous);
              }}
            >
              Anterior
            </button>
            <button
              disabled={!contacts.data?.nextCursor}
              onClick={() => {
                setHistory((items) => [...items, cursor]);
                setCursor(contacts.data?.nextCursor ?? undefined);
              }}
            >
              Siguiente
            </button>
          </div>
        )}
      </section>

      {creating && (
        <ContactDialog
          pending={createContact.isPending}
          error={createContact.error?.message}
          onClose={() => {
            setCreating(false);
            createContact.reset();
          }}
          onSubmit={(payload) => createContact.mutate(payload)}
        />
      )}
    </AppShell>
  );
}

function ContactsTable({ contacts }: { contacts: Contact[] }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>NIF</th>
            <th>Contacto</th>
            <th>Condiciones</th>
            <th>Tipo</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id}>
              <td>
                <strong>{contact.legalName}</strong>
                {contact.tradeName && <small>{contact.tradeName}</small>}
              </td>
              <td>{contact.taxId ?? "—"}</td>
              <td>{contact.email ?? contact.phone ?? "—"}</td>
              <td>
                {contact.paymentTermsDays
                  ? `${contact.paymentTermsDays} días`
                  : "Al contado"}
              </td>
              <td>
                <span className="tag">
                  {contact.isSupplier ? "Cliente · Proveedor" : "Cliente"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContactDialog({
  pending,
  error,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  error?: string;
  onClose(): void;
  onSubmit(payload: ReturnType<typeof contactPayload>): void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, pending]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(
      contactPayload(Object.fromEntries(new FormData(event.currentTarget))),
    );
  }
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-contact-title"
      >
        <header>
          <div>
            <p className="eyebrow">Nuevo registro</p>
            <h2 id="new-contact-title">Crear cliente</h2>
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
        <form onSubmit={submit} className="contact-form">
          <label className="field full">
            <span>Razón social *</span>
            <input
              name="legalName"
              required
              maxLength={240}
              autoFocus
              placeholder="Cliente Ejemplo SL"
            />
          </label>
          <label className="field">
            <span>Nombre comercial</span>
            <input
              name="tradeName"
              maxLength={240}
              placeholder="Cliente Ejemplo"
            />
          </label>
          <label className="field">
            <span>NIF</span>
            <input
              name="taxId"
              maxLength={40}
              autoCapitalize="characters"
              placeholder="B12345674"
            />
          </label>
          <label className="field">
            <span>Correo de facturación</span>
            <input
              name="email"
              type="email"
              maxLength={320}
              placeholder="facturas@cliente.es"
            />
          </label>
          <label className="field">
            <span>Teléfono</span>
            <input
              name="phone"
              type="tel"
              maxLength={40}
              placeholder="+34 600 000 000"
            />
          </label>
          <label className="field">
            <span>Plazo de pago</span>
            <select name="paymentTermsDays" defaultValue="30">
              <option value="0">Al contado</option>
              <option value="15">15 días</option>
              <option value="30">30 días</option>
              <option value="60">60 días</option>
              <option value="90">90 días</option>
            </select>
          </label>
          <label className="field">
            <span>Método habitual</span>
            <select name="paymentMethod" defaultValue="BANK_TRANSFER">
              <option value="BANK_TRANSFER">Transferencia</option>
              <option value="DIRECT_DEBIT">Domiciliación</option>
              <option value="CARD">Tarjeta</option>
              <option value="CASH">Efectivo</option>
              <option value="OTHER">Otro</option>
            </select>
          </label>
          <label className="check-field full">
            <input name="isSupplier" type="checkbox" />
            <span>También es proveedor</span>
          </label>
          {error && (
            <p className="form-error full" role="alert">
              {error}
            </p>
          )}
          <footer className="dialog-actions full">
            <button
              type="button"
              className="text-button"
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
              {pending ? "Guardando…" : "Guardar cliente"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="loading-rows" aria-live="polite">
      <span />
      <span />
      <span />
      <p>Cargando clientes…</p>
    </div>
  );
}
