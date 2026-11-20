"use client";

import type { ApiError, GiftClaimResponse, Locale, MobileMoneyAccount } from "@zaweli/shared-types";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { formatMoney, MobileMoneyForm, usePaymentPolling } from "@/components/account/mobile-money";
import { Banner, Field, TextInput } from "@/components/account/ui";
import { storedAccessCode } from "@/components/experience/live-experience";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/[\s/.]+$/, "");

/** Textes de la page de réception, dans la langue de l'expérience (tutoiement, comme le template). */
const TEXT = {
  fr: {
    kicker: "Un cadeau t'attend",
    title: (amount: string) => `${amount} pour toi`,
    lead: "Cet argent a déjà été versé. Indique ton nom et ton numéro mobile money : il t'est envoyé tout de suite.",
    beneficiary: "Ton nom complet",
    beneficiaryHint: "Tel qu'il apparaît sur ton compte mobile money.",
    country: "Pays",
    network: "Réseau",
    phone: "Ton numéro mobile money",
    phoneHint: (dial: string) => `Avec ou sans l'indicatif +${dial}.`,
    invalidPhone: "Ce numéro ne correspond pas au pays choisi.",
    submit: (amount: string) => `Recevoir ${amount}`,
    sending: "Envoi…",
    pending: "Envoi en cours vers ton mobile money. Cette page se met à jour toute seule.",
    slow: "Ton réseau n'a pas encore confirmé. Tu peux fermer cette page : l'envoi continue.",
    transferred: "C'est reçu : l'argent est sur ton mobile money.",
    retry: "Le dernier envoi n'a pas abouti. Vérifie ton numéro et ton réseau, puis réessaie.",
    unavailable: "Il n'y a rien à recevoir ici pour le moment.",
    notFound: "Ce lien n'est plus disponible.",
    error: "Une erreur est survenue. Réessaie dans un instant.",
    back: "← Revenir à l'expérience",
    privacy: "Ton numéro sert uniquement à cet envoi : Zaweli n'en garde que les 4 derniers chiffres.",
  },
  en: {
    kicker: "A gift is waiting for you",
    title: (amount: string) => `${amount} for you`,
    lead: "This money has already been paid. Enter your name and mobile money number: it is sent to you right away.",
    beneficiary: "Your full name",
    beneficiaryHint: "As it appears on your mobile money account.",
    country: "Country",
    network: "Network",
    phone: "Your mobile money number",
    phoneHint: (dial: string) => `With or without the +${dial} prefix.`,
    invalidPhone: "This number does not match the selected country.",
    submit: (amount: string) => `Receive ${amount}`,
    sending: "Sending…",
    pending: "Sending to your mobile money. This page updates by itself.",
    slow: "Your network has not confirmed yet. You can close this page: the transfer continues.",
    transferred: "Received: the money is on your mobile money.",
    retry: "The last transfer did not go through. Check your number and network, then try again.",
    unavailable: "There is nothing to receive here right now.",
    notFound: "This link is no longer available.",
    error: "Something went wrong. Please try again in a moment.",
    back: "← Back to the experience",
    privacy: "Your number is only used for this transfer: Zaweli keeps only its last 4 digits.",
  },
} satisfies Record<Locale, unknown>;

async function call(method: "GET" | "POST", url: string, body?: unknown, code?: string | null): Promise<GiftClaimResponse> {
  const res = await fetch(`${API_URL}/v1${url}`, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(code ? { "x-access-code": code } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => null)) as ApiError | null;
    throw Object.assign(new Error(error?.error.message ?? ""), { status: res.status });
  }
  return (await res.json()) as GiftClaimResponse;
}

/**
 * Réception d'un cadeau d'argent par le destinataire, sans compte : le lien
 * de l'expérience fait office de clé. L'argent n'est annoncé « reçu » que
 * lorsque le réseau a confirmé l'envoi (webhook vérifié, P6).
 */
export function ClaimGift({ slug, giftId }: { slug: string; giftId: string }) {
  const path = `/public/experiences/${encodeURIComponent(slug)}/gifts/${giftId}/claim`;
  const [info, setInfo] = useState<GiftClaimResponse | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  const refresh = useCallback(async () => setInfo(await call("GET", path, undefined, storedAccessCode(slug))), [path, slug]);
  useEffect(() => {
    let alive = true;
    void call("GET", path, undefined, storedAccessCode(slug))
      .then((r) => alive && setInfo(r))
      .catch((e: { status?: number }) => alive && (e.status === 404 ? setMissing(true) : setError(TEXT.fr.error)));
    return () => {
      alive = false;
    };
  }, [path, slug]);
  const slow = usePaymentPolling(info?.state === "pending", refresh);

  const t = TEXT[info?.locale ?? "fr"];
  if (missing) return <Shell><p className="text-center text-[1.05rem]">{TEXT.fr.notFound}</p></Shell>;
  if (!info) return <Shell>{error ? <Banner tone="danger">{error}</Banner> : <p aria-busy="true" className="text-center text-muted">…</p>}</Shell>;

  const amount = formatMoney(info.amount, info.currency, info.locale);
  const submit = async (account: MobileMoneyAccount) => {
    setNameTouched(true);
    if (name.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      setInfo(await call("POST", path, { beneficiary: name.trim(), account }, storedAccessCode(slug)));
    } catch (e) {
      setError((e as Error).message || t.error);
      await refresh().catch(() => undefined);
    }
    setBusy(false);
  };

  return (
    <Shell back={t.back} slug={slug}>
      <p className="kicker text-muted">{t.kicker}</p>
      <h1 className="display mt-3 text-[clamp(2.2rem,9vw,3.2rem)]">{t.title(amount)}</h1>
      <div className="mt-8 space-y-5" aria-live="polite">
        {info.state === "claimable" && (
          <>
            <p className="text-[1rem] text-muted">{t.lead}</p>
            {info.lastAttemptFailed && <Banner tone="warning">{t.retry}</Banner>}
            <form onSubmit={(e: FormEvent) => e.preventDefault()}>
              <Field label={t.beneficiary} hint={t.beneficiaryHint} error={nameTouched && name.trim().length < 2 ? t.beneficiary : undefined}>
                {(p) => <TextInput {...p} autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}
              </Field>
            </form>
            <MobileMoneyForm
              currency={info.currency}
              locale={info.locale}
              busy={busy}
              submitLabel={busy ? t.sending : t.submit(amount)}
              labels={t}
              onSubmit={submit}
            />
            <p className="text-[0.82rem] text-muted">{t.privacy}</p>
          </>
        )}
        {info.state === "pending" && (
          <>
            <Banner tone="info">{t.pending}</Banner>
            {slow && <p className="text-[0.88rem] text-muted">{t.slow}</p>}
          </>
        )}
        {info.state === "transferred" && <Banner tone="success">{t.transferred}</Banner>}
        {info.state === "unavailable" && <p className="text-[1rem] text-muted">{t.unavailable}</p>}
        {error && <Banner tone="danger">{error}</Banner>}
      </div>
    </Shell>
  );
}

function Shell({ children, back, slug }: { children: React.ReactNode; back?: string; slug?: string }) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-5 py-16">
      {children}
      {back && slug && (
        <a href={`/g/${encodeURIComponent(slug)}`} className="link-draw mt-10 self-start text-[0.92rem] text-muted">
          {back}
        </a>
      )}
    </main>
  );
}
