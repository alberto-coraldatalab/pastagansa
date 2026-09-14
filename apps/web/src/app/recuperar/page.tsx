import Link from "next/link";
import { PasswordResetForm } from "./password-reset-form";

export default async function PasswordRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="auth-layout">
      <section className="brand-panel" aria-labelledby="brand-title">
        <Link className="wordmark wordmark-light" href="/">
          PastaGansa
        </Link>
        <div>
          <p className="eyebrow">Acceso seguro</p>
          <h1 id="brand-title">Recupera tu cuenta sin perder el trabajo.</h1>
          <p className="brand-copy">
            El enlace solo puede utilizarse una vez y caduca automáticamente.
          </p>
        </div>
        <p className="brand-footnote">
          La nueva contraseña cerrará las demás sesiones
        </p>
      </section>
      <section className="form-panel">
        <PasswordResetForm token={token ?? ""} />
      </section>
    </main>
  );
}
