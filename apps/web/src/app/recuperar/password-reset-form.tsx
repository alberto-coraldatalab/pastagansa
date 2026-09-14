"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export function PasswordResetForm({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setError(
          response.status === 400
            ? "El enlace ha caducado o ya se ha utilizado. Solicita uno nuevo."
            : (body.error ?? "No hemos podido cambiar la contraseña."),
        );
        return;
      }
      setComplete(true);
    } catch {
      setError("No podemos conectar con el servicio. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  if (complete)
    return (
      <div className="auth-card">
        <p className="eyebrow">Contraseña actualizada</p>
        <h2>Ya puedes volver a entrar</h2>
        <p className="auth-support-copy">
          Hemos cerrado las sesiones anteriores para proteger tu cuenta.
        </p>
        <Link className="primary-button auth-button-link" href="/acceso">
          Ir al acceso
        </Link>
      </div>
    );

  return (
    <div className="auth-card">
      <Link className="wordmark wordmark-mobile" href="/">
        PastaGansa
      </Link>
      <div className="form-heading">
        <p className="eyebrow">Recuperar contraseña</p>
        <h2>Elige una contraseña nueva</h2>
        <p>Utiliza al menos 12 caracteres que no uses en otro servicio.</p>
      </div>
      {token ? (
        <form className="auth-form" onSubmit={submit}>
          <label className="field">
            <span>Nueva contraseña</span>
            <input
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              name="password"
              required
              type="password"
            />
          </label>
          <label className="field">
            <span>Repite la contraseña</span>
            <input
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              name="confirmation"
              required
              type="password"
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </form>
      ) : (
        <p className="form-error" role="alert">
          Falta el token de recuperación. Solicita un enlace nuevo al
          administrador de la instalación.
        </p>
      )}
      <Link className="auth-secondary-link" href="/acceso">
        Volver al acceso
      </Link>
    </div>
  );
}
