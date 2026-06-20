import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";
import IdleLogoutWatcher from "@/components/auth/IdleLogoutWatcher";
import AccessPending from "@/components/auth/AccessPending";
import { Providers } from "@/components/theme/Providers";
import { isAdminOrOwner } from "@/lib/security";

// MVP6.1: acceso limitado a owner (Xabier) + admin (Edgard) mientras se valida
// el modelo. NO extender a clientes todavía. Para abrir a clientes: poner
// CLIENTS_ENABLED = true (un solo cambio).
const CLIENTS_ENABLED = false;

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Puerta de acceso: solo owner/admin entran hasta que se habilite a clientes.
  if (!CLIENTS_ENABLED && !isAdminOrOwner(user)) {
    return (
      <Providers>
        <AccessPending />
      </Providers>
    );
  }

  return (
    <Providers>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-[var(--color-bg)] px-4 py-16 md:px-8 md:py-8">
          {children}
        </main>
        <IdleLogoutWatcher />
      </div>
    </Providers>
  );
}
