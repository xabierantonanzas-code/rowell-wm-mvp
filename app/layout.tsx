import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rowell Patrimonios",
  description: "Dashboard patrimonial para gestion de carteras de inversion",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${playfair.variable}`}>
      <head>
        {/* Anti-FOUC: apply theme class before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('rowell-theme');if(t==='modern')document.documentElement.classList.add('theme-modern');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-rowell-light font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
