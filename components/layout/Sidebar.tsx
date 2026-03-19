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

export default function Sidebar() {
  const pathname = usePathname();
  const { user, isAdmin, loading, signOut } = useUser();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <Link href={isAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-rowell-gold" />
          <span className="font-display text-xl font-bold text-rowell-navy">
            Rowell
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
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
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-rowell-navy/10 text-rowell-navy"
                  : "text-gray-600 hover:bg-gray-100 hover:text-rowell-dark"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  isActive ? "text-rowell-gold" : "text-gray-400"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-gray-200 p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="truncate text-sm">
              <p className="font-medium text-rowell-dark">
                {user?.email ?? "Usuario"}
              </p>
              <p className="text-xs text-gray-400">
                {isAdmin ? "Administrador" : "Cliente"}
              </p>
            </div>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
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
