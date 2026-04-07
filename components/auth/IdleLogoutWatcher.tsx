"use client";

// MVP6 punto 1 (Edgard): Logout automatico tras 10 minutos de inactividad.
//
// Detecta eventos de actividad del usuario (mouse, teclado, touch, scroll)
// y resetea un temporizador. Si pasan IDLE_MS sin actividad, llama a
// supabase.auth.signOut() y redirige a /login.
//
// Caracteristicas:
// - Solo se activa si hay sesion (user != null).
// - Avisa al usuario 60 segundos antes con un toast/banner.
// - Al recibir focus en otra pestana, si el reloj ya expiro, cierra sesion
//   inmediatamente.
// - Reset del temporizador escribe en localStorage para que TODAS las
//   pestanas compartan el mismo timeout.

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const IDLE_MS = 10 * 60 * 1000; // 10 min
const WARN_MS = 60 * 1000;       // aviso 60s antes
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
    warnRef.current = setTimeout(() => setWarning(true), IDLE_MS - WARN_MS);
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
        warnRef.current = setTimeout(() => setWarning(true), IDLE_MS - WARN_MS);
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
    <div className="fixed bottom-4 right-4 z-[100] flex items-center gap-3 rounded-xl border border-[#B8965A] bg-white px-4 py-3 shadow-2xl">
      <div className="text-sm">
        <p className="font-semibold text-[#3D4F63]">Sesion a punto de expirar</p>
        <p className="text-xs text-gray-500">
          Por inactividad, te desconectaras en menos de 1 minuto.
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-[#3D4F63] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#293544]"
      >
        Seguir
      </button>
    </div>
  );
}
