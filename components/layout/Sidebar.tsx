"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/lib/hooks/useUser";
import {
  LayoutDashboard,
  Users,
  Upload,
  LogOut,
  Loader2,
  TrendingUp,
  HelpCircle,
  Menu,
  X,
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
  { label: "Ayuda", href: "/ayuda", icon: HelpCircle },
];

function SidebarContent({
  onClose,
  isMobile,
}: {
  onClose?: () => void;
  isMobile?: boolean;
}) {
  const pathname = usePathname();
  const { user, isAdmin, isOwner, loading, signOut } = useUser();

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "RW";

  return (
    <>
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5"
          onClick={onClose}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C9A84C]/20">
            <TrendingUp className="h-4 w-4 text-[#C9A84C]" />
          </div>
          <div>
            <span className="font-display text-lg font-bold leading-none text-white">
              Rowell
            </span>
            <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[#C9A84C]">
              Patrimonios
            </p>
          </div>
        </Link>
        {isMobile && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-white/30">
          Principal
        </p>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-[#C9A84C]/15 text-white"
                  : "text-white/50 hover:bg-white/5 hover:text-white/90"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-[#C9A84C]" />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 flex-shrink-0",
                  isActive ? "text-[#C9A84C]" : "text-white/30 group-hover:text-white/60"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-white/30">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#C9A84C] text-xs font-semibold text-[#0B1D3A]">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white/80">
                  {user?.email ?? "Usuario"}
                </p>
                <p className="text-[10px] text-white/35">
                  {isOwner ? "Owner" : isAdmin ? "Administrador" : "Cliente"}
                </p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/35 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="h-3.5 w-3.5" />
              Cerrar sesion
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile hamburger button — fixed top-left */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-lg bg-[#0B1D3A] text-white shadow-lg md:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile drawer + overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-[#0B1D3A] shadow-2xl animate-in slide-in-from-left duration-200">
            <SidebarContent
              onClose={() => setMobileOpen(false)}
              isMobile
            />
          </aside>
        </div>
      )}

      {/* Desktop sidebar — always visible ≥ md */}
      <aside className="hidden h-screen w-64 flex-shrink-0 flex-col bg-[#0B1D3A] md:flex">
        <SidebarContent />
      </aside>
    </>
  );
}
