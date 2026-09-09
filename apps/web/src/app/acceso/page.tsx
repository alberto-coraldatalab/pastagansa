import { AuthPanel } from "./auth-panel";
import Link from "next/link";

export default function AccessPage() {
  return (
    <main className="auth-layout">
      <section className="brand-panel" aria-labelledby="brand-title">
        <Link className="wordmark wordmark-light" href="/">
          PastaGansa
        </Link>
        <div>
          <p className="eyebrow">Gestión clara para avanzar</p>
          <h1 id="brand-title">Tus ventas y compras, de principio a fin.</h1>
          <p className="brand-copy">
            Factura, cobra, registra gastos y mantén la contabilidad conectada
            sin perder el contexto de tu empresa.
          </p>
        </div>
        <p className="brand-footnote">
          Diseñado para empresas españolas · EUR · IVA
        </p>
      </section>
      <section className="form-panel">
        <AuthPanel />
      </section>
    </main>
  );
}
