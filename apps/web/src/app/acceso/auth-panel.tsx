"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setError(body.error ?? "No hemos podido completar la operación.");
        return;
      }
      router.replace("/inicio");
      router.refresh();
    } catch {
      setError("No podemos conectar con el servicio. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-card">
      <Link className="wordmark wordmark-mobile" href="/">
        PastaGansa
      </Link>
      <div className="mode-switch" aria-label="Elige cómo acceder">
        <button
          className={mode === "login" ? "active" : ""}
          onClick={() => switchMode("login")}
          type="button"
        >
          Entrar
        </button>
        <button
          className={mode === "register" ? "active" : ""}
          onClick={() => switchMode("register")}
          type="button"
        >
          Crear cuenta
        </button>
      </div>
      <div className="form-heading">
        <p className="eyebrow">
          {mode === "login" ? "Bienvenido de nuevo" : "Primer paso"}
        </p>
        <h2>
          {mode === "login"
            ? "Entra en tu empresa"
            : "Crea tu espacio de trabajo"}
        </h2>
        <p>
          {mode === "login"
            ? "Continúa donde lo dejaste."
            : "Tendrás una empresa lista para configurar."}
        </p>
      </div>
      <form onSubmit={submit} className="auth-form">
        {mode === "register" && (
          <>
            <Field
              label="Nombre de la organización"
              name="organizationName"
              autoComplete="organization"
              placeholder="Grupo Acme"
            />
            <Field
              label="Razón social"
              name="legalName"
              autoComplete="organization"
              placeholder="Acme Servicios SL"
            />
            <Field
              label="NIF"
              name="taxId"
              autoComplete="off"
              placeholder="B12345674"
            />
          </>
        )}
        <Field
          label="Correo electrónico"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tu@empresa.es"
        />
        <Field
          label="Contraseña"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={mode === "register" ? 12 : 1}
          placeholder={
            mode === "register" ? "12 caracteres como mínimo" : "Tu contraseña"
          }
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={pending} type="submit">
          {pending
            ? "Un momento…"
            : mode === "login"
              ? "Entrar"
              : "Crear cuenta"}
        </button>
      </form>
      <p className="trust-copy">
        Tus credenciales se mantienen fuera del JavaScript del navegador.
      </p>
    </div>
  );

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
  }
}

function Field({
  label,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...input} required />
    </label>
  );
}
