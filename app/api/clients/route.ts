import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAllAccounts } from "@/lib/queries/clients";

// ===========================================================================
// GET /api/clients — lista ligera de clientes {id, name} para el buscador del
// desplegable "Evolución de cartera" del sidebar. Solo admin/owner.
// Deduplica por cliente (un cliente puede tener varias cuentas).
// ===========================================================================
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = user?.app_metadata?.role;
  if (!user || (role !== "admin" && role !== "owner")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const accounts = await getAllAccounts();
  const seen = new Map<string, string>();
  for (const a of accounts) {
    const c = a.clients;
    if (c?.id && !seen.has(c.id)) {
      seen.set(c.id, c.full_name ?? "(sin nombre)");
    }
  }

  const clients = Array.from(seen, ([id, name]) => ({ id, name })).sort((x, y) =>
    x.name.localeCompare(y.name, "es")
  );

  return NextResponse.json({ clients });
}
