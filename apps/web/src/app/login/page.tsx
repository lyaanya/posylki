"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dictionary } from "@/lib/dictionary";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type Mode = "signIn" | "signUp";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleEmailAuth(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createSupabaseBrowserClient();

    if (mode === "signIn") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message || dictionary.auth.genericError);
        setLoading(false);
        return;
      }

      router.push("/profile");
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setError(signUpError.message || dictionary.auth.genericError);
      setLoading(false);
      return;
    }

    setMessage(dictionary.auth.signUpSuccess);
    setLoading(false);
  }

  async function handleGoogle() {
    setError(null);
    const supabase = createSupabaseBrowserClient();

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/profile" },
    });

    if (oauthError) {
      setError(oauthError.message || dictionary.auth.genericError);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-10">
      <h1 className="font-heading text-2xl font-bold text-foreground">
        {mode === "signIn" ? dictionary.auth.signInTitle : dictionary.auth.signUpTitle}
      </h1>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <form className="flex flex-col gap-4" onSubmit={handleEmailAuth}>
          <Field label={dictionary.auth.emailLabel}>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label={dictionary.auth.passwordLabel}>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
          </Field>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? <p className="text-sm text-success">{message}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-action px-4 py-2.5 text-sm font-medium text-on-action transition-colors hover:bg-action-hover disabled:opacity-60"
          >
            {mode === "signIn" ? dictionary.auth.signInCta : dictionary.auth.signUpCta}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setMessage(null);
            setMode((m) => (m === "signIn" ? "signUp" : "signIn"));
          }}
          className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signIn" ? dictionary.auth.switchToSignUp : dictionary.auth.switchToSignIn}
        </button>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">{dictionary.auth.orDivider}</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          className="w-full rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          {dictionary.auth.googleCta}
        </button>
      </div>
    </div>
  );
}
