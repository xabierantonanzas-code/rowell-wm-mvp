"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, TrendingUp, Check } from "lucide-react";

export default function InviteConfirmPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase processes the invite token from the URL hash automatically
  useEffect(() => {
    const supabase = createClient();

    // Listen for auth state change (token exchange)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") {
          setSessionReady(true);
          setChecking(false);
        }
      }
    );

    // Check if already signed in (token already exchanged)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      }
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      // Get user info to link to client
      const { data: { user } } = await supabase.auth.getUser();

      if (user?.email) {
        // Call API to link auth user to client
        await fetch("/api/invite/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, userId: user.id }),
        });
      }

      setSuccess(true);

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 2000);
    } catch {
      setError("Error al crear la contraseña. Intenta de nuevo.");
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5]">
        <Loader2 className="h-8 w-8 animate-spin text-[#3D4F63]" />
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5] px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#3D4F63]">
              <TrendingUp className="h-6 w-6 text-[#B8965A]" />
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold text-[#3D4F63]">
            Enlace invalido o expirado
          </h1>
          <p className="text-sm text-gray-500">
            Este enlace de invitacion ya no es valido. Contacta con tu asesor
            para recibir una nueva invitacion.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5] px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#3D4F63]">
            Cuenta creada
          </h1>
          <p className="text-sm text-gray-500">
            Redirigiendo a tu dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5] px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#3D4F63]">
            <TrendingUp className="h-7 w-7 text-[#B8965A]" />
          </div>
          <h1 className="font-display text-3xl font-bold text-[#3D4F63]">
            Rowell
          </h1>
          <p className="mt-1 text-sm text-[#3D4F63]/60">Patrimonios</p>
        </div>

        {/* Form */}
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <h2 className="mb-2 text-xl font-semibold text-[#3D4F63]">
            Bienvenido a Rowell
          </h2>
          <p className="mb-6 text-sm text-gray-500">
            Crea tu contraseña para acceder a tu portal de inversiones.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-[#3D4F63]"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Minimo 8 caracteres"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#B8965A] focus:ring-2 focus:ring-[#B8965A]/20"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirm"
                className="text-sm font-medium text-[#3D4F63]"
              >
                Confirmar contraseña
              </label>
              <input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Repite la contraseña"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#B8965A] focus:ring-2 focus:ring-[#B8965A]/20"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#B8965A] px-4 py-3 text-sm font-semibold text-[#3D4F63] shadow-sm transition-colors hover:bg-[#b8993f] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                "Crear mi cuenta"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400">
          Rowell Patrimonios — Tu portal personal de inversiones
        </p>
      </div>
    </div>
  );
}
