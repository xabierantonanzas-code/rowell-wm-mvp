"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "owner" | "admin" | "client";

interface UseUserReturn {
  user: User | null;
  role: AppRole;
  isOwner: boolean;
  isAdmin: boolean;
  isAdminOrOwner: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const rawRole = user?.app_metadata?.role ?? null;
  const role: AppRole = rawRole === "owner" ? "owner" : rawRole === "admin" ? "admin" : "client";
  const isOwner = role === "owner";
  const isAdmin = role === "admin" || role === "owner";
  const isAdminOrOwner = isAdmin;

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/login";
  };

  return { user, role, isOwner, isAdmin, isAdminOrOwner, loading, signOut };
}
