"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/lib/hooks/useUser";
import { useTheme } from "@/components/theme/ThemeContext";
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
  Palette,
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
  const { themeName, toggleTheme } = useTheme();
  const isModern = themeName === "modern";

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "RW";

  return (
    <>
      <div
        className={cn(
          "flex h-16 items-center justify-between px-6",
          isModern
            ? "border-b border-gray-200"
            : "border-b border-white/10"
        )}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5"
          onClick={onClose}
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-gold-20)]"
          >
            <TrendingUp className="h-4 w-4 text-[var(--color-gold)]" />
          </div>
          <div>
            <span
              className={cn(
                "font-display text-lg font-bold leading-none",
                isModern ? "text-gray-900" : "text-white"
              )}
            >
              Rowell
            </span>
            <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--color-gold)]">
              Patrimonios
            </p>
          </div>
        </Link>
        {isMobile && (
          <button
            onClick={onClose}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              isModern
                ? "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                : "text-white/50 hover:bg-white/10 hover:text-white"
            )}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <p
          className={cn(
            "mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.14em]",
            isModern ? "text-gray-400" : "text-white/30"
          )}
        >
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
                isModern
                  ? isActive
                    ? "bg-[var(--color-gold-10)] text-gray-900"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  : isActive
                    ? "bg-[var(--color-gold-15)] text-white"
                    : "text-white/50 hover:bg-white/5 hover:text-white/90"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-[var(--color-gold)]" />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 flex-shrink-0",
                  isModern
                    ? isActive
                      ? "text-[var(--color-gold)]"
                      : "text-gray-400 group-hover:text-gray-600"
                    : isActive
                      ? "text-[var(--color-gold)]"
                      : "text-white/30 group-hover:text-white/60"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div
        className={cn(
          "px-4 py-2",
          isModern ? "border-t border-gray-200" : "border-t border-white/10"
        )}
      >
        <button
          onClick={toggleTheme}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors",
            isModern
              ? "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              : "text-white/40 hover:bg-white/10 hover:text-white/70"
          )}
        >
          <Palette className="h-3.5 w-3.5" />
          {isModern ? "Estilo Rowell" : "Modo moderno"}
        </button>
      </div>

      {/* User section */}
      <div
        className={cn(
          "p-4",
          isModern ? "border-t border-gray-200" : "border-t border-white/10"
        )}
      >
        {loading ? (
          <div
            className={cn(
              "flex items-center gap-2 text-sm",
              isModern ? "text-gray-400" : "text-white/30"
            )}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  isModern
                    ? "bg-[var(--color-gold)] text-white"
                    : "bg-[var(--color-gold)] text-[var(--color-primary)]"
                )}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-xs font-medium",
                    isModern ? "text-gray-700" : "text-white/80"
                  )}
                >
                  {user?.email ?? "Usuario"}
                </p>
                <p
                  className={cn(
                    "text-[10px]",
                    isModern ? "text-gray-400" : "text-white/35"
                  )}
                >
                  {isOwner ? "Owner" : isAdmin ? "Administrador" : "Cliente"}
                </p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400/60 transition-colors hover:bg-red-500/10 hover:text-red-400"
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
  const { themeName } = useTheme();
  const isModern = themeName === "modern";

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
        className={cn(
          "fixed left-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-lg shadow-lg md:hidden",
          isModern
            ? "bg-white text-gray-700 border border-gray-200"
            : "bg-[var(--color-primary)] text-white"
        )}
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
          <aside
            className={cn(
              "relative flex h-full w-72 max-w-[85vw] flex-col shadow-2xl animate-in slide-in-from-left duration-200",
              isModern
                ? "bg-white border-r border-gray-200"
                : "bg-[var(--color-primary)]"
            )}
          >
            <SidebarContent
              onClose={() => setMobileOpen(false)}
              isMobile
            />
          </aside>
        </div>
      )}

      {/* Desktop sidebar — always visible ≥ md */}
      <aside
        className={cn(
          "hidden h-screen w-64 flex-shrink-0 flex-col md:flex",
          isModern
            ? "bg-white border-r border-gray-200"
            : "bg-[var(--color-primary)]"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
