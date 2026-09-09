import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PastaGansa",
  description: "Facturación y gestión para empresas españolas",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
