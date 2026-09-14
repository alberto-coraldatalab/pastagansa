"use client";

import { AppShell } from "@/components/app-shell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";

type Session = {
  id: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
  isCurrent: boolean;
};

export function SecurityView() {
  const queryClient = useQueryClient();
  const [passwordMessage, setPasswordMessage] = useState<{
    kind: "success" | "error";
    text: string;
  }>();
  const sessions = useQuery({
    queryKey: ["security-sessions"],
    queryFn: () => requestJson<Session[]>("/api/auth/security"),
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      requestJson<void>(`/api/auth/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["security-sessions"] }),
  });
  const changePassword = useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      requestJson<void>("/api/auth/security", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
  });

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage(undefined);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== String(form.get("confirmation") ?? "")) {
      setPasswordMessage({
        kind: "error",
        text: "Las contraseñas no coinciden.",
      });
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      formElement.reset();
      setPasswordMessage({
        kind: "success",
        text: "Contraseña actualizada. Las demás sesiones se han cerrado.",
      });
      await queryClient.invalidateQueries({ queryKey: ["security-sessions"] });
    } catch (error) {
      setPasswordMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "No se pudo actualizar.",
      });
    }
  }

  return (
    <AppShell active="seguridad">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Cuenta</p>
          <h1>Seguridad</h1>
          <p>Cambia tu contraseña y revisa dónde tienes la sesión abierta.</p>
        </div>
      </div>
      <div className="security-grid">
        <section className="security-card" aria-labelledby="password-title">
          <h2 id="password-title">Cambiar contraseña</h2>
          <p>La sesión actual seguirá abierta; cerraremos todas las demás.</p>
          <form className="auth-form" onSubmit={submitPassword}>
            <PasswordField
              autoComplete="current-password"
              label="Contraseña actual"
              name="currentPassword"
              minLength={1}
            />
            <PasswordField
              autoComplete="new-password"
              label="Nueva contraseña"
              name="newPassword"
              minLength={12}
            />
            <PasswordField
              autoComplete="new-password"
              label="Repite la contraseña nueva"
              name="confirmation"
              minLength={12}
            />
            {passwordMessage && (
              <p
                className={
                  passwordMessage.kind === "error"
                    ? "form-error"
                    : "form-success"
                }
                role={passwordMessage.kind === "error" ? "alert" : "status"}
              >
                {passwordMessage.text}
              </p>
            )}
            <button
              className="primary-button"
              disabled={changePassword.isPending}
              type="submit"
            >
              {changePassword.isPending ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        </section>
        <section className="security-card" aria-labelledby="sessions-title">
          <h2 id="sessions-title">Sesiones</h2>
          <p>Revoca cualquier sesión que no reconozcas.</p>
          {sessions.isPending ? (
            <p aria-live="polite">Cargando sesiones…</p>
          ) : sessions.error ? (
            <p className="form-error" role="alert">
              {sessions.error.message}
            </p>
          ) : (
            <ul className="session-list">
              {sessions.data?.map((session) => (
                <li key={session.id}>
                  <div>
                    <strong>
                      {session.isCurrent ? "Esta sesión" : "Sesión"}
                    </strong>
                    <span>Iniciada {formatDate(session.createdAt)}</span>
                    <small>
                      {session.status === "ACTIVE"
                        ? `Caduca ${formatDate(session.expiresAt)}`
                        : "Cerrada"}
                    </small>
                  </div>
                  {session.status === "ACTIVE" && !session.isCurrent && (
                    <button
                      className="text-button"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(session.id)}
                      type="button"
                    >
                      Cerrar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {revoke.error && (
            <p className="form-error" role="alert">
              {revoke.error.message}
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function PasswordField({
  label,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...input} maxLength={128} required type="password" />
    </label>
  );
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => undefined);
  if (!response.ok)
    throw new Error(
      (body as { error?: string } | undefined)?.error ??
        "No se pudo completar la operación.",
    );
  return body as T;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
