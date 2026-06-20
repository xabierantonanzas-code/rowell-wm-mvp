// Versión del software mostrada en la app (footer).
// Valores inyectados en build desde next.config.mjs (env):
//   NEXT_PUBLIC_APP_VERSION  → package.json
//   NEXT_PUBLIC_COMMIT_SHA   → commit corto de Vercel (vacío en local)
//   NEXT_PUBLIC_BUILD_DATE   → fecha del build
// Fuente única de versión: package.json.

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
export const COMMIT_SHA = process.env.NEXT_PUBLIC_COMMIT_SHA ?? "";
export const BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE ?? "";

/** Ej.: "v0.1.0 · a1b2c3d · 2026-06-14" (commit/fecha se omiten si faltan). */
export const VERSION_LABEL = [
  `v${APP_VERSION}`,
  COMMIT_SHA || null,
  BUILD_DATE || null,
]
  .filter(Boolean)
  .join(" · ");
