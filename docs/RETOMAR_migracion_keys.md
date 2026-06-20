# Retomar: migración de API keys Supabase (legacy → nuevas)

Objetivo: mover la app a las keys nuevas e invalidar la service_role legacy
que quedó expuesta. Paso final IRREVERSIBLE — hacerlo con tiempo, no con prisa.

Red de seguridad: Vercel → Deployments → "Instant Rollback" revierte al deploy
bueno actual si algo se rompe.

App usa 3 env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY.

## Paso 1 — Copiar keys nuevas (Supabase → Settings → API Keys)
- Publishable key (sb_publishable_...)  → reemplaza la anon
- Secret key (sb_secret_..., botón Reveal) → reemplaza la service_role

## Paso 2 — Vercel → Settings → Environment Variables (Production)
- NEXT_PUBLIC_SUPABASE_ANON_KEY  = publishable (sb_publishable_...)
- SUPABASE_SERVICE_ROLE_KEY      = secret (sb_secret_...)
- NEXT_PUBLIC_SUPABASE_URL       = SIN TOCAR

## Paso 3 — Redeploy (los env vars no aplican hasta redeploy)
Deployments → último → Redeploy.

## Paso 4 — VERIFICAR (gate antes de lo irreversible)
Probar en la app en vivo:
- [ ] Login funciona
- [ ] Dashboard de un cliente carga (positions, gráficos)
- [ ] Admin "Todos los Clientes" carga KPIs  <-- LO MÁS RIESGOSO (usa service_role/secret + MV global_kpis con GRANT a service_role). Si la sb_secret_ no actúa como service_role, esto falla.
- [ ] X-Ray de un cliente carga datos reales
Si TODO ok → seguir. Si algo falla → Instant Rollback + restaurar env vars legacy.

## Paso 5 — Desactivar legacy (IRREVERSIBLE, solo si Paso 4 pasa)
Supabase → API Keys → "Disable legacy API keys". Invalida la service_role expuesta.

## Seguridad (ClaudeOS)
- Secrets solo en env de Vercel, nunca en código/git.
- service_role/secret solo server-side (admin.ts). publishable = pública (RLS).
- RLS sigue habilitada en todas las tablas.
- Tras migrar, volver a pasar owasp-security si se tocó algo de auth.
