"use client";

// MVP6 punto 11 (Edgard): Logout automatico tras inactividad.
//
// Detecta eventos de actividad del usuario (mouse, teclado, touch, scroll)
// y resetea un temporizador. Si pasan IDLE_MS sin actividad, muestra un
// modal de aviso. Si el usuario no responde en WARNING_MS, llama a
// supabase.auth.signOut() y redirige a /login.
//
// Caracteristicas:
// - Solo se activa si hay sesion (user != null).
// - Avisa al usuario WARNING_MS antes con un modal.
// - Botones "Si, seguir" (resetea timer) y "Cerrar sesion" (logout inmediato).
// - Al recibir focus en otra pestana, si el reloj ya expiro, cierra sesion
//   inmediatamente.
// - Reset del temporizador escribe en localStorage para que TODAS las
//   pestanas compartan el mismo timeout.
//
// Hypercare (MVP6): 30 min + 2 min warning.
// Release: cambiar IDLE_MS a 20 * 60 * 1000.

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const IDLE_MS = 30 * 60 * 1000;   // 30 min (hypercare); cambiar a 20 min en release
const WARNING_MS = 2 * 60 * 1000; // 2 min de aviso antes de logout
const STORAGE_KEY = "rowell:lastActivity";

const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

export default function IdleLogoutWatcher() {
  const [warning, setWarning] = useState(false);
  const [active, setActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabaseRef = useRef(createClient());

  const clearTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warnRef.current) clearTimeout(warnRef.current);
    timeoutRef.current = null;
    warnRef.current = null;
  };

  const doLogout = useCallback(async () => {
    clearTimers();
    try {
      await supabaseRef.current.auth.signOut();
    } catch {
      /* noop */
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
      window.location.href = "/login?reason=idle";
    }
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    setWarning(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    }
    warnRef.current = setTimeout(() => setWarning(true), IDLE_MS - WARNING_MS);
    timeoutRef.current = setTimeout(doLogout, IDLE_MS);
  }, [doLogout]);

  // Verificar sesion al montar
  useEffect(() => {
    let cancelled = false;
    supabaseRef.current.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      if (data.user) {
        setActive(true);
        reset();
      }
    });
    const {
      data: { subscription },
    } = supabaseRef.current.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setActive(true);
        reset();
      } else {
        setActive(false);
        clearTimers();
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listeners de actividad
  useEffect(() => {
    if (!active) return;

    const handler = () => reset();
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, handler, { passive: true });
    }

    // Sincronizacion entre pestanas
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        // Otra pestana hizo reset -> alineamos
        clearTimers();
        warnRef.current = setTimeout(() => setWarning(true), IDLE_MS - WARNING_MS);
        timeoutRef.current = setTimeout(doLogout, IDLE_MS);
        setWarning(false);
      }
    };
    window.addEventListener("storage", onStorage);

    // Si la pestana recupera focus tras estar oculta, comprobar si ya
    // expiro el plazo absoluto
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const lastStr = window.localStorage.getItem(STORAGE_KEY);
      const last = lastStr ? Number(lastStr) : 0;
      if (last && Date.now() - last >= IDLE_MS) {
        doLogout();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, handler);
      }
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, reset, doLogout]);

  if (!active || !warning) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-[var(--color-gold)] bg-white p-6 shadow-2xl">
        <p className="text-base font-semibold text-[var(--color-primary)]">Sesion a punto de expirar</p>
        <p className="mt-2 text-sm text-gray-500">
          Por inactividad, tu sesion se cerrara en menos de 2 minutos. ¿Deseas seguir conectado?
        </p>
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={doLogout}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cerrar sesion
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-dark)]"
          >
            Si, seguir
          </button>
        </div>
      </div>
    </div>
  );
}
