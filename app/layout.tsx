import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rowell Dashboard",
  description: "Dashboard patrimonial para gestion de carteras de inversion",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
