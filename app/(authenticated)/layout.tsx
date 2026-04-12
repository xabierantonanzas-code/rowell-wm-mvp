import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";
import IdleLogoutWatcher from "@/components/auth/IdleLogoutWatcher";
import { Providers } from "@/components/theme/Providers";

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
