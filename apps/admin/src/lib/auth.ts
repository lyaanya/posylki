"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "./supabase-client";

export interface SessionState {
  status: "loading" | "signedIn" | "signedOut";
  email: string | null;
}

/** Тот же принцип, что apps/web/src/lib/auth.ts — реактивная сессия Supabase Auth. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: "loading", email: null });

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    function apply(session: Session | null) {
      if (cancelled) return;
      setState(session?.user.email ? { status: "signedIn", email: session.user.email } : { status: "signedOut", email: null });
    }

    supabase.auth.getSession().then(({ data: { session } }) => apply(session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => apply(session));

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.signOut();
}
