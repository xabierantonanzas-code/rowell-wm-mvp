"use client";

import { useUser } from "@/lib/hooks/useUser";

/**
 * Pantalla de acceso restringido (MVP6.1).
 * El dashboard está limitado a owner (Xabier) + admin (Edgard) hasta que se
 * extienda a clientes. Cualquier rol `client` que inicie sesión ve esto en
 * lugar del dashboard. Para reactivar el acceso de clientes: poner
 * `CLIENTS_ENABLED = true` en app/(authenticated)/layout.tsx.
 */
export default function AccessPending() {
  const { signOut } = useUser();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg)] px-6 text-center">
      <h1 className="font-display text-2xl font-bold text-[var(--color-primary)]">
        Acceso en preparación
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-gray-600">
        Tu cartera estará disponible próximamente. Estamos terminando de validar
        los datos antes de abrir el acceso. Tu asesor de Rowell Patrimonios te
        avisará cuando puedas entrar.
      </p>
      <button
        type="button"
        onClick={signOut}
        className="mt-2 rounded-lg border border-[var(--color-gold)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-gold)] hover:text-white"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
