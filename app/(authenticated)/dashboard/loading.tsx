/**
 * Fallback de Suspense que Next.js (App Router) renderiza automaticamente
 * mientras `page.tsx` resuelve la data en el server. Cubre el momento de
 * "carga inicial" del dashboard: en vez de pantalla en blanco mientras se
 * traen positions / history / operations de Supabase, el usuario ve un
 * esqueleto + indicador de carga con la paleta MVP6.
 *
 * No requiere logica: su sola existencia activa el streaming/Suspense de la
 * ruta. Se desmonta solo cuando la pagina termina de cargar.
 */
import PortfolioLoader from "@/components/ui/PortfolioLoader";

export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      {/* Indicador explicito */}
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <PortfolioLoader size={24} label="Cargando datos de la cartera" />
        Cargando datos de la cartera…
      </div>

      {/* Header skeleton */}
      <div className="h-32 animate-pulse rounded-xl bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-primary)]/10" />

      {/* KPI tiles skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-gray-200 bg-white"
          />
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="h-72 animate-pulse rounded-xl border border-gray-200 bg-white" />
    </div>
  );
}
