"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useState } from "react";

export function AdminMark() {
  return (
    <span className="flex items-center gap-2">
      <span className="text-[1.15rem] font-semibold tracking-tight">Zaweli</span>
      <span className="rounded-md bg-accent px-1.5 py-0.5 text-[0.7rem] font-semibold tracking-wide text-accent-ink uppercase">Admin</span>
    </span>
  );
}

export function StatusScreen({ title, text, action }: { title: string; text?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <main className="grid min-h-svh place-items-center px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-surface p-7">
        <AdminMark />
        <h1 className="mt-6 text-lg font-semibold">{title}</h1>
        {text && <p className="mt-2 text-sm text-ink-2">{text}</p>}
        {action && (
          <button type="button" onClick={action.onClick} className="mt-6 h-10 rounded-lg border border-line px-4 text-sm hover:bg-raised">
            {action.label}
          </button>
        )}
      </div>
    </main>
  );
}

/** Connexion Supabase Auth : mot de passe, ou lien envoyé par e-mail. */
export function LoginScreen({ message, getClient }: { message?: string; getClient: () => SupabaseClient }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(message ?? null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error: err } = await getClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) setError("Identifiants refusés. Vérifiez l'adresse et le mot de passe.");
  };

  const magicLink = async () => {
    if (!email) return setError("Saisissez d'abord votre adresse e-mail.");
    setBusy(true);
    setError(null);
    const { error: err } = await getClient().auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin, shouldCreateUser: false } });
    setBusy(false);
    if (err) setError("Envoi impossible. Réessayez dans un instant.");
    else setInfo("Si ce compte existe, un lien de connexion vient de lui être envoyé.");
  };

  const field = "mt-1.5 h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-ink-2";
  return (
    <main className="grid min-h-svh place-items-center px-4">
      <form onSubmit={signIn} className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-surface p-7">
        <AdminMark />
        <h1 className="mt-6 text-lg font-semibold">Connexion à l&apos;administration</h1>
        <p className="mt-1 text-sm text-muted">Réservé à l&apos;équipe Zaweli.</p>
        <label className="mt-6 block text-sm">
          Adresse e-mail
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </label>
        <label className="mt-4 block text-sm">
          Mot de passe
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
        </label>
        {error && (
          <p role="alert" className="mt-4 text-sm text-bad">
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="mt-4 text-sm text-good">
            {info}
          </p>
        )}
        <button type="submit" disabled={busy} className="mt-6 h-10 w-full rounded-lg bg-accent text-sm font-medium text-accent-ink disabled:opacity-60">
          Se connecter
        </button>
        <button type="button" onClick={magicLink} disabled={busy} className="mt-3 h-10 w-full rounded-lg border border-line text-sm hover:bg-raised disabled:opacity-60">
          Recevoir un lien de connexion
        </button>
      </form>
    </main>
  );
}
