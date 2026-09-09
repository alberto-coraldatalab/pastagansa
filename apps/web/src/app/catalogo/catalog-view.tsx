"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  catalogPayload,
  formatMoney,
  taxLabel,
  type CatalogItem,
  type CatalogPage,
} from "@/lib/catalog";

export function CatalogView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<(string | undefined)[]>([]);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const catalog = useQuery({
    queryKey: ["catalog", search, cursor],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "20" });
      if (search) params.set("search", search);
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/catalog?${params}`);
      const body = (await response.json()) as CatalogPage & { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "No se pudo cargar el catálogo.");
      return body;
    },
  });
  const createItem = useMutation({
    mutationFn: async (payload: ReturnType<typeof catalogPayload>) => {
      const response = await fetch("/api/catalog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as CatalogItem & { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "No se pudo guardar el elemento.");
      return body;
    },
    onSuccess: async (item) => {
      await queryClient.invalidateQueries({ queryKey: ["catalog"] });
      setCreating(false);
      setNotice(`${item.name} ya está disponible para facturar.`);
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
    <AppShell active="catalogo">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Ventas · Maestros</p>
          <h1>Catálogo</h1>
          <p>Productos y servicios listos para añadir a una factura.</p>
        </div>
        <button
          className="primary-button compact"
          onClick={() => setCreating(true)}
        >
          Nuevo elemento
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
      <section className="data-panel" aria-labelledby="catalog-title">
        <div className="data-toolbar">
          <div>
            <h2 id="catalog-title">Elementos activos</h2>
            <p>
              {catalog.data
                ? `${catalog.data.data.length} en esta página`
                : "Cargando…"}
            </p>
          </div>
          <form className="search-form" onSubmit={applySearch} role="search">
            <label className="sr-only" htmlFor="catalog-search">
              Buscar en el catálogo
            </label>
            <input
              id="catalog-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nombre o SKU"
              maxLength={100}
            />
            <button type="submit">Buscar</button>
          </form>
        </div>
        {catalog.isPending && <LoadingRows />}
        {catalog.error && (
          <div className="inline-error" role="alert">
            <strong>No se pudo cargar el catálogo</strong>
            <p>{catalog.error.message}</p>
            <button onClick={() => void catalog.refetch()}>Reintentar</button>
          </div>
        )}
        {catalog.data?.data.length === 0 && (
          <div className="empty-state">
            <span>PR</span>
            <h3>
              {search ? "No hay coincidencias" : "Crea tu primer servicio"}
            </h3>
            <p>
              {search
                ? "Prueba con otro nombre o SKU."
                : "Después podrás añadirlo a una factura sin volver a escribir sus datos."}
            </p>
            {!search && (
              <button
                className="secondary-button"
                onClick={() => setCreating(true)}
              >
                Nuevo elemento
              </button>
            )}
          </div>
        )}
        {!!catalog.data?.data.length && (
          <CatalogTable items={catalog.data.data} />
        )}
        {(history.length > 0 || catalog.data?.nextCursor) && (
          <div className="pagination" aria-label="Paginación del catálogo">
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
              disabled={!catalog.data?.nextCursor}
              onClick={() => {
                setHistory((items) => [...items, cursor]);
                setCursor(catalog.data?.nextCursor ?? undefined);
              }}
            >
              Siguiente
            </button>
          </div>
        )}
      </section>
      {creating && (
        <CatalogDialog
          pending={createItem.isPending}
          error={createItem.error?.message}
          onClose={() => {
            setCreating(false);
            createItem.reset();
          }}
          onSubmit={(payload) => createItem.mutate(payload)}
        />
      )}
    </AppShell>
  );
}

function CatalogTable({ items }: { items: CatalogItem[] }) {
  return (
    <div className="table-scroll">
      <table className="data-table catalog-table">
        <thead>
          <tr>
            <th>Producto o servicio</th>
            <th>SKU</th>
            <th>Precio</th>
            <th>IVA sugerido</th>
            <th>Tipo</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.name}</strong>
                <small>
                  {item.description ?? `Por ${unitLabel(item.unit)}`}
                </small>
              </td>
              <td>{item.sku ?? "—"}</td>
              <td className="money-cell">
                {formatMoney(item.salesPrice, item.currency)}
              </td>
              <td>{taxLabel(item.suggestedTaxCode)}</td>
              <td>
                <span
                  className={`tag ${item.type === "PRODUCT" ? "tag-neutral" : ""}`}
                >
                  {item.type === "SERVICE" ? "Servicio" : "Producto"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CatalogDialog({
  pending,
  error,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  error?: string;
  onClose(): void;
  onSubmit(payload: ReturnType<typeof catalogPayload>): void;
}) {
  const [type, setType] = useState<"SERVICE" | "PRODUCT">("SERVICE");
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
      catalogPayload(Object.fromEntries(new FormData(event.currentTarget))),
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
        aria-labelledby="new-item-title"
      >
        <header>
          <div>
            <p className="eyebrow">Nuevo registro</p>
            <h2 id="new-item-title">Añadir al catálogo</h2>
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
          <label className="field">
            <span>Tipo *</span>
            <select
              name="type"
              value={type}
              onChange={(event) =>
                setType(event.target.value as "SERVICE" | "PRODUCT")
              }
            >
              <option value="SERVICE">Servicio</option>
              <option value="PRODUCT">Producto</option>
            </select>
          </label>
          <label className="field">
            <span>SKU o referencia</span>
            <input name="sku" maxLength={80} placeholder="CONS-01" />
          </label>
          <label className="field full">
            <span>Nombre *</span>
            <input
              name="name"
              required
              maxLength={240}
              autoFocus
              placeholder="Consultoría mensual"
            />
          </label>
          <label className="field full">
            <span>Descripción</span>
            <textarea
              name="description"
              maxLength={4000}
              rows={3}
              placeholder="Descripción que podrás reutilizar en la factura"
            />
          </label>
          <label className="field">
            <span>Unidad</span>
            <select name="unit" defaultValue="unit">
              <option value="unit">Unidad</option>
              <option value="hour">Hora</option>
              <option value="service">Servicio</option>
              <option value="month">Mes</option>
            </select>
          </label>
          <label className="field">
            <span>Precio de venta · EUR</span>
            <input
              name="salesPrice"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0,00"
            />
          </label>
          <label className="field">
            <span>IVA sugerido</span>
            <select name="suggestedTaxCode" defaultValue="ES_VAT_GENERAL_21">
              <option value="ES_VAT_GENERAL_21">IVA 21 %</option>
              <option value="ES_VAT_REDUCED_10">IVA 10 %</option>
              <option value="ES_VAT_SUPER_REDUCED_4">IVA 4 %</option>
              <option value="ES_VAT_ZERO_0">IVA 0 %</option>
              <option value="">Sin sugerencia</option>
            </select>
          </label>
          <label className="field">
            <span>Cuenta de ingresos</span>
            <input
              name="revenueAccountCode"
              maxLength={20}
              placeholder="705000"
            />
          </label>
          {type === "PRODUCT" && (
            <label className="check-field full">
              <input name="trackInventory" type="checkbox" />
              <span>Controlar existencias</span>
            </label>
          )}
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
              {pending ? "Guardando…" : "Guardar elemento"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function unitLabel(unit: string) {
  return (
    { unit: "unidad", hour: "hora", service: "servicio", month: "mes" }[unit] ??
    unit
  );
}

function LoadingRows() {
  return (
    <div className="loading-rows" aria-live="polite">
      <span />
      <span />
      <span />
      <p>Cargando catálogo…</p>
    </div>
  );
}
