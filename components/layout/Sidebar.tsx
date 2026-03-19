"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/lib/hooks/useUser";
import {
  LayoutDashboard,
  Users,
  Upload,
  LogOut,
  BarChart3,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clientes", href: "/admin", icon: Users, adminOnly: true },
  { label: "Upload", href: "/upload", icon: Upload, adminOnly: true },
];

function getInitials(email: string | undefined): string {
  if (!email) return "U";
  const parts = email.split("@")[0].split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, isAdmin, loading, signOut } = useUser();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <aside className="flex h-screen w-64 flex-col bg-[#0B1D3A]">
      {/* Logo + Patrimonios */}
      <div className="flex h-20 flex-col justify-center border-b border-white/10 px-6">
        <Link href={isAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-[#C9A84C]" />
          <span className="font-display text-xl font-bold text-white">
            Rowell
          </span>
        </Link>
        <span className="mt-0.5 pl-9 text-[10px] font-semibold tracking-[0.25em] text-[#C9A84C]">
          PATRIMONIOS
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80"
              )}
            >
              {/* Gold active bar on the left */}
              {isActive && (
                <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[#C9A84C]" />
              )}
              <Icon
                className={cn(
                  "h-5 w-5",
                  isActive ? "text-[#C9A84C]" : "text-white/40"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-white/10 p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-white/40">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {/* Avatar with initials */}
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#C9A84C] bg-[#C9A84C]/10">
                <span className="text-xs font-bold text-[#C9A84C]">
                  {getInitials(user?.email ?? undefined)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {user?.email ?? "Usuario"}
                </p>
                <p className="text-xs text-white/40">
                  {isAdmin ? "Administrador" : "Cliente"}
                </p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/40 transition-colors hover:bg-white/5 hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesion
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
