"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { authConfigured, authErrorCode, getSupabase, publicOrigin, safeNext } from "@/account/client";
import { FullPageStatus, useAccount } from "@/account/session";
import { Wordmark } from "@/components/site/header";
import { Banner, Button, Field, PasswordInput, TextInput } from "./ui";

/** Règle partagée avec Supabase (config.toml) : 8 caractères au moins, lettres et chiffres. */
const strongEnough = (p: string) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

/** Mise en page des écrans d'accès : centrée, sans navigation, retour au site possible. */
export function AuthShell({ children }: { children: ReactNode }) {
  const { t, path } = useAccount();
  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <header className="mx-auto flex w-full max-w-[84rem] items-center justify-between px-5 py-5 sm:px-8">
        <Link href={path("/")} className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          <Wordmark />
        </Link>
        <Link href={path("/")} className="link-draw text-[0.9rem] text-muted">
          {t.common.backToSite}
        </Link>
      </header>
      <main id="contenu" className="flex flex-1 items-start justify-center px-5 pt-6 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-[26rem]">{children}</div>
      </main>
    </div>
  );
}

/** Les écrans d'accès ne servent à rien à quelqu'un de déjà connecté : direction l'espace. */
function useLeaveWhenSignedIn() {
  const { state, path } = useAccount();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"), path("/espace"));
  useEffect(() => {
    if (state.kind === "signed-in") router.replace(next);
  }, [state.kind, router, next]);
  return { next, ready: state.kind === "signed-out" };
}

function Heading({ title, lead }: { title: string; lead: string }) {
  return (
    <>
      <h1 className="display text-[clamp(2.2rem,8vw,2.8rem)]">{title}</h1>
      <p className="mt-3 text-[1rem] leading-relaxed text-muted">{lead}</p>
    </>
  );
}

function GoogleButton({ next }: { next: string }) {
  const { t } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await getSupabase().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${next}`, queryParams: { prompt: "select_account" } },
      });
      if (err) throw err;
    } catch (err) {
      setBusy(false);
      setError(t.auth.errors[authErrorCode(err)]);
    }
  };
  return (
    <div>
      <Button variant="secondary" onClick={signIn} disabled={busy} className="w-full">
        <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {t.auth.google}
      </Button>
      {error && <p className="mt-2 text-[0.86rem] text-danger" role="alert">{error}</p>}
    </div>
  );
}

function Divider() {
  const { t } = useAccount();
  return (
    <div className="my-6 flex items-center gap-4 text-[0.85rem] text-muted" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      {t.auth.or}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function NotConfigured() {
  const { t } = useAccount();
  return authConfigured ? null : (
    <div className="mt-6">
      <Banner tone="warning">{t.auth.errors.not_configured}</Banner>
    </div>
  );
}

// ---------------------------------------------------------------------
// Connexion
// ---------------------------------------------------------------------

export function LoginView() {
  const { t, path } = useAccount();
  const router = useRouter();
  const { next, ready } = useLeaveWhenSignedIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (err) throw err;
      router.replace(next);
    } catch (err) {
      const code = authErrorCode(err);
      if (code === "email_not_confirmed") {
        await getSupabase().auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: `${publicOrigin()}${next}` } }).catch(() => undefined);
        router.push(`${path("/verifier")}?email=${encodeURIComponent(email.trim())}&next=${encodeURIComponent(next)}`);
        return;
      }
      setError(t.auth.errors[code]);
      setBusy(false);
    }
  };

  if (!ready) return <FullPageStatus text={t.common.loading} />;
  return (
    <>
      <Heading title={t.auth.login.title} lead={t.auth.login.lead} />
      <NotConfigured />
      <div className="mt-8">
        <GoogleButton next={next} />
      </div>
      <Divider />
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label={t.auth.email}>
          {(p) => <TextInput {...p} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label={t.auth.password}>
          {(p) => (
            <PasswordInput
              {...p}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              showLabel={t.auth.showPassword}
              hideLabel={t.auth.hidePassword}
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Link href={`${path("/mot-de-passe")}?email=${encodeURIComponent(email)}`} className="link-draw text-[0.88rem] text-muted">
            {t.auth.login.forgot}
          </Link>
        </div>
        {error && <Banner tone="danger">{error}</Banner>}
        <Button type="submit" disabled={busy || !email || !password} className="w-full">
          {busy ? t.common.loading : t.auth.login.submit}
        </Button>
      </form>
      <p className="mt-8 text-center text-[0.92rem] text-muted">
        {t.auth.login.noAccount}{" "}
        <Link href={`${path("/inscription")}?next=${encodeURIComponent(next)}`} className="text-primary underline underline-offset-4">
          {t.auth.login.toSignup}
        </Link>
      </p>
    </>
  );
}

// ---------------------------------------------------------------------
// Inscription : e-mail, mot de passe, prénom facultatif, puis code OTP
// ---------------------------------------------------------------------

export function SignupView() {
  const { t, locale, path } = useAccount();
  const router = useRouter();
  const { next, ready } = useLeaveWhenSignedIn();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!strongEnough(password)) return setError(t.auth.errors.weak_password);
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Reprises par le profil (langue, nom) et par l'e-mail du code (langue).
          data: { locale, ...(name.trim() ? { display_name: name.trim() } : {}) },
          emailRedirectTo: `${publicOrigin()}${next}`,
        },
      });
      if (err) throw err;
      // Confirmation désactivée côté Supabase : la session arrive tout de suite.
      if (data.session) return router.replace(next);
      router.push(`${path("/verifier")}?email=${encodeURIComponent(email.trim())}&next=${encodeURIComponent(next)}`);
    } catch (err) {
      setError(t.auth.errors[authErrorCode(err)]);
      setBusy(false);
    }
  };

  if (!ready) return <FullPageStatus text={t.common.loading} />;
  return (
    <>
      <Heading title={t.auth.signup.title} lead={t.auth.signup.lead} />
      <NotConfigured />
      <div className="mt-8">
        <GoogleButton next={next} />
      </div>
      <Divider />
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label={t.auth.displayName} optionalLabel={t.common.optional}>
          {(p) => <TextInput {...p} autoComplete="given-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label={t.auth.email}>
          {(p) => <TextInput {...p} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label={t.auth.password} hint={t.auth.passwordHint}>
          {(p) => (
            <PasswordInput
              {...p}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              showLabel={t.auth.showPassword}
              hideLabel={t.auth.hidePassword}
            />
          )}
        </Field>
        {error && <Banner tone="danger">{error}</Banner>}
        <Button type="submit" disabled={busy || !email || !password} className="w-full">
          {busy ? t.common.loading : t.auth.signup.submit}
        </Button>
        <p className="text-[0.82rem] leading-relaxed text-muted">{t.auth.signup.terms}</p>
      </form>
      <p className="mt-8 text-center text-[0.92rem] text-muted">
        {t.auth.signup.hasAccount}{" "}
        <Link href={`${path("/connexion")}?next=${encodeURIComponent(next)}`} className="text-primary underline underline-offset-4">
          {t.auth.signup.toLogin}
        </Link>
      </p>
    </>
  );
}

/** Saisie d'un code à 6 chiffres : clavier numérique, collage accepté, remplissage automatique depuis le SMS/e-mail. */
function CodeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <Field label={label}>
      {(p) => (
        <TextInput
          {...p}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="text-center font-display text-[1.8rem] tracking-[0.5em]"
        />
      )}
    </Field>
  );
}

function useResend(email: string, type: "signup" | "recovery") {
  const { t, path } = useAccount();
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const resend = async () => {
    try {
      const client = getSupabase();
      const { error } = type === "signup" ? await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${publicOrigin()}${path("/espace")}` } }) : await client.auth.resetPasswordForEmail(email, { redirectTo: `${publicOrigin()}${path("/espace")}` });
      if (error) throw error;
      setMessage({ tone: "success", text: t.auth.verify.resent });
      setCooldown(60);
    } catch (err) {
      setMessage({ tone: "danger", text: t.auth.errors[authErrorCode(err)] });
    }
  };
  return { resend, message, cooldown };
}

// ---------------------------------------------------------------------
// Vérification du code reçu à l'inscription
// ---------------------------------------------------------------------

export function VerifyView() {
  const { t, path, state } = useAccount();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), path("/espace"));
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { resend, message, cooldown } = useResend(email, "signup");
  const knownEmail = Boolean(params.get("email"));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await getSupabase().auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
      if (err) throw err;
      router.replace(next);
    } catch (err) {
      const c = authErrorCode(err);
      setError(t.auth.errors[c === "generic" ? "otp_expired" : c]);
      setBusy(false);
    }
  };

  if (state.kind === "loading") return <FullPageStatus text={t.common.loading} />;
  return (
    <>
      <Heading title={t.auth.verify.title} lead={knownEmail ? t.auth.verify.lead(email) : t.auth.verify.leadNoEmail} />
      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        {!knownEmail && (
          <Field label={t.auth.email}>
            {(p) => <TextInput {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
        )}
        <CodeInput value={code} onChange={setCode} label={t.auth.verify.code} />
        {error && <Banner tone="danger">{error}</Banner>}
        {message && <Banner tone={message.tone}>{message.text}</Banner>}
        <Button type="submit" disabled={busy || code.length !== 6 || !email} className="w-full">
          {busy ? t.common.loading : t.auth.verify.submit}
        </Button>
      </form>
      <p className="mt-6 text-[0.88rem] text-muted">{t.auth.verify.spam}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="quiet" onClick={resend} disabled={!email || cooldown > 0}>
          {cooldown > 0 ? `${t.auth.verify.resend} (${cooldown} s)` : t.auth.verify.resend}
        </Button>
        <Link href={`${path("/inscription")}?next=${encodeURIComponent(next)}`} className="link-draw text-[0.88rem] text-muted">
          {t.auth.verify.wrongEmail}
        </Link>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------
// Mot de passe oublié : code par e-mail, puis nouveau mot de passe
// ---------------------------------------------------------------------

export function ResetView() {
  const { t, path } = useAccount();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { resend, message, cooldown } = useResend(email.trim(), "recovery");

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${publicOrigin()}${path("/espace")}` });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(t.auth.errors[authErrorCode(err)]);
    }
    setBusy(false);
  };

  const change = async (e: FormEvent) => {
    e.preventDefault();
    if (!strongEnough(password)) return setError(t.auth.errors.weak_password);
    setBusy(true);
    setError(null);
    try {
      const client = getSupabase();
      const verified = await client.auth.verifyOtp({ email: email.trim(), token: code, type: "recovery" });
      if (verified.error) throw Object.assign(verified.error, { code: "otp_expired" });
      const updated = await client.auth.updateUser({ password });
      if (updated.error) throw updated.error;
      router.replace(path("/espace"));
    } catch (err) {
      setError(t.auth.errors[authErrorCode(err)]);
      setBusy(false);
    }
  };

  return (
    <>
      <Heading title={t.auth.reset.title} lead={sent ? t.auth.reset.sentLead(email.trim()) : t.auth.reset.lead} />
      <NotConfigured />
      {!sent ? (
        <form onSubmit={send} className="mt-8 space-y-5" noValidate>
          <Field label={t.auth.email}>
            {(p) => <TextInput {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          {error && <Banner tone="danger">{error}</Banner>}
          <Button type="submit" disabled={busy || !email} className="w-full">
            {busy ? t.common.loading : t.auth.reset.send}
          </Button>
        </form>
      ) : (
        <form onSubmit={change} className="mt-8 space-y-5" noValidate>
          <CodeInput value={code} onChange={setCode} label={t.auth.verify.code} />
          <Field label={t.auth.reset.newPassword} hint={t.auth.passwordHint}>
            {(p) => (
              <PasswordInput
                {...p}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                showLabel={t.auth.showPassword}
                hideLabel={t.auth.hidePassword}
              />
            )}
          </Field>
          {error && <Banner tone="danger">{error}</Banner>}
          {message && <Banner tone={message.tone}>{message.text}</Banner>}
          <Button type="submit" disabled={busy || code.length !== 6 || !password} className="w-full">
            {busy ? t.common.loading : t.auth.reset.submit}
          </Button>
          <Button variant="quiet" onClick={resend} disabled={cooldown > 0}>
            {cooldown > 0 ? `${t.auth.verify.resend} (${cooldown} s)` : t.auth.verify.resend}
          </Button>
        </form>
      )}
      <p className="mt-8">
        <Link href={path("/connexion")} className="link-draw text-[0.9rem] text-muted">
          {t.auth.reset.back}
        </Link>
      </p>
    </>
  );
}
