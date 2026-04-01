import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Proteger todas las rutas excepto:
     * - _next/static (assets estaticos)
     * - _next/image (optimizacion de imagenes)
     * - favicon.ico
     * - /login (pagina publica)
     * - /auth (callbacks de auth)
     */
    "/((?!_next/static|_next/image|favicon.ico|login|auth|invite|api/health).*)",
  ],
};
