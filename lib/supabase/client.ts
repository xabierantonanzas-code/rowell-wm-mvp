import { createBrowserClient } from "@supabase/ssr";

// Singleton del cliente de navegador.
//
// `createBrowserClient` registra el refresco de token de auth usando el Web
// Locks API (navigator.locks) con un lock exclusivo `lock:sb-<ref>-auth-token`.
// Si cada componente crea su PROPIA instancia, varias contienden por ese mismo
// lock a la vez y una acaba lanzando "Acquiring an exclusive Navigator
// LockManager lock timed out waiting 10000ms".
//
// La solución recomendada por Supabase es compartir UNA instancia por pestaña.
// Mantiene la misma anon key + RLS; no afecta a la seguridad, solo evita la
// contención del lock. El cliente de servidor (`lib/supabase/server`) es
// distinto y SÍ se crea por request — no tocar.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browserClient: ReturnType<typeof createBrowserClient<any>> | undefined;

export function createClient() {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return browserClient;
}
