/**
 * PortfolioLoader — indicador de carga "barras de cartera" (paleta MVP6).
 *
 * Cuatro barras que crecen como un grafico de barras (primary + gold
 * alternos). Las clases y la animacion viven en `app/globals.css`
 * (`.rowell-loader` + keyframe `rowell-bar-grow`). El componente solo
 * pinta el markup, asi que funciona tanto en server como en client
 * components (no necesita "use client").
 *
 * Tamano: la animacion esta en `em`, asi que escala con `font-size`.
 * `size` fija el alto del loader en px (= font-size del contenedor).
 */
export default function PortfolioLoader({
  size = 28,
  className = "",
  label,
}: {
  size?: number;
  className?: string;
  /** Texto accesible para lectores de pantalla. */
  label?: string;
}) {
  return (
    <span
      className={`rowell-loader ${className}`}
      style={{ fontSize: size }}
      role="status"
      aria-label={label ?? "Cargando"}
    >
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </span>
  );
}
