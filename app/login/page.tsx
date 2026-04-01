"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const trimmedEmail = email.trim();

    // Step 1: Check rate limit
    try {
      const checkRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, action: "check" }),
      });

      if (checkRes.status === 429) {
        const data = await checkRes.json();
        setError(data.error ?? "Demasiados intentos. Espera 15 minutos.");
        setLoading(false);
        return;
      }
    } catch {
      // If rate limit check fails, proceed anyway (don't block login)
    }

    // Step 2: Client-side login (sets cookies correctly)
    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (authError) {
      // Log failure
      fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, action: "failure" }),
      }).catch(() => {});

      setError(
        authError.message === "Invalid login credentials"
          ? "Email o contraseña incorrectos"
          : authError.message
      );
      setLoading(false);
      return;
    }

    // Log success
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmedEmail, action: "success" }),
    }).catch(() => {});

    // Redirect based on role
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const role = user?.app_metadata?.role;

    // Admin/owner → operational dashboard, client → portfolio
    router.push("/dashboard");

    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-rowell-light px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo / Brand */}
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold text-rowell-navy">
            Rowell
          </h1>
          <p className="mt-1 text-sm text-rowell-navy/60">
            Patrimonios
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-xl font-semibold text-rowell-dark">
            Iniciar Sesion
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-rowell-dark">
                Email
              </Label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="edgard@rowell.es"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm
                  outline-none transition-colors
                  focus:border-rowell-gold focus:ring-2 focus:ring-rowell-gold/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-rowell-dark">
                Contraseña
              </Label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm
                  outline-none transition-colors
                  focus:border-rowell-gold focus:ring-2 focus:ring-rowell-gold/20"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400">
          Acceso restringido. Contacta con tu asesor para obtener credenciales.
        </p>
      </div>
    </div>
  );
}
