"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "./supabase-client";

export interface SessionState {
  status: "loading" | "signedIn" | "signedOut";
  email: string | null;
  /**
   * Только из Google — лёгкая подсказка для шапки без похода на бэкенд.
   * Настоящее имя (после E06) живёт в /profile/me и может отличаться,
   * если пользователь его отредактировал.
   */
  displayName: string | null;
}

function nameFromSession(session: Session): string | null {
  const meta = session.user.user_metadata as Record<string, unknown> | undefined;
  const name = meta?.["full_name"] ?? meta?.["name"];
  return typeof name === "string" && name.trim().length > 0 ? name.trim() : null;
}

/**
 * Реальное состояние сессии Supabase Auth, реактивное на вход/выход —
 * общее для Header и профиля, чтобы оба не расходились между собой.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    status: "loading",
    email: null,
    displayName: null,
  });

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    function apply(session: Session | null) {
      if (cancelled) return;
      setState(
        session?.user.email
          ? { status: "signedIn", email: session.user.email, displayName: nameFromSession(session) }
          : { status: "signedOut", email: null, displayName: null },
      );
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

export async function signOut(): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.signOut();
}
