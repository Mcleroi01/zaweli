"use client";

import { countriesForCurrency, type Locale, type MobileMoneyAccount, normalizePhone, type PaymentNext } from "@zaweli/shared-types";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "@/account/session";
import { Banner, Button, Field, Select, TextInput } from "./ui";

/** Montant lisible dans la langue de la page (« 21,00 $US », « 14 000 FC »). */
export function formatMoney(amount: string | number, currency: string, locale: Locale) {
  try {
    return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { style: "currency", currency }).format(Number(amount));
  } catch {
    return `${amount} ${currency}`;
  }
}

const networkName = (code: string) => (code.length <= 4 ? code.toUpperCase() : code[0]!.toUpperCase() + code.slice(1));

/**
 * Pays, réseau et numéro mobile money pour une devise donnée. Seuls les pays
 * où MbiyoPay accepte cette devise sont proposés ; le numéro est vérifié au
 * format du pays avant l'envoi (le serveur revérifie).
 */
export function MobileMoneyForm({
  currency,
  submitLabel,
  busy,
  onSubmit,
  labels,
  locale,
  defaultCountry,
}: {
  currency: string;
  submitLabel: string;
  busy: boolean;
  onSubmit: (account: MobileMoneyAccount) => void;
  /** Libellés propres à la page publique (sans espace client). */
  labels: { country: string; network: string; phone: string; phoneHint: (dial: string) => string; invalidPhone: string };
  locale: Locale;
  defaultCountry?: string | null;
}) {
  const countries = useMemo(() => countriesForCurrency(currency), [currency]);
  const initial = countries.find((c) => c.code === defaultCountry) ?? countries[0];
  const [countryCode, setCountryCode] = useState(initial?.code ?? "");
  const [network, setNetwork] = useState(initial?.networks[0] ?? "");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const country = countries.find((c) => c.code === countryCode) ?? countries[0];
  const names = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);
  const valid = Boolean(country && normalizePhone(country.code, phone));

  if (!country) return null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    onSubmit({ countryCode: country.code, network, phoneNumber: phone.trim() });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.country}>
          {(p) => (
            <Select
              {...p}
              value={country.code}
              onChange={(e) => {
                const next = countries.find((c) => c.code === e.target.value)!;
                setCountryCode(next.code);
                setNetwork(next.networks[0]!);
              }}
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {names.of(c.code) ?? c.code}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={labels.network}>
          {(p) => (
            <Select {...p} value={network} onChange={(e) => setNetwork(e.target.value)}>
              {country.networks.map((n) => (
                <option key={n} value={n}>
                  {networkName(n)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label={labels.phone} hint={labels.phoneHint(country.dialCode)} error={touched && !valid ? labels.invalidPhone : undefined}>
        {(p) => (
          <TextInput
            {...p}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={`+${country.dialCode} …`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" disabled={busy} className="w-full sm:w-auto">
        {submitLabel}
      </Button>
    </form>
  );
}

/**
 * Interroge l'état d'un paiement toutes les 3 s tant qu'il est en cours
 * (10 minutes au plus : au-delà, la page invite à revenir plus tard).
 */
export function usePaymentPolling(active: boolean, refresh: () => Promise<unknown>) {
  const [slow, setSlow] = useState(false);
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    let stopped = false;
    const timer = setInterval(() => {
      if (stopped) return;
      const elapsed = Date.now() - started;
      if (elapsed > 90_000) setSlow(true);
      if (elapsed > 10 * 60_000) {
        clearInterval(timer);
        return;
      }
      void latest.current().catch(() => undefined);
    }, 3_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [active]);
  return active && slow;
}

/** Ce que la personne doit faire pendant que le paiement attend (USSD, page Wave, consignes, code). */
export function PaymentNextStep({ next, slow, onFinalize }: { next: PaymentNext; slow: boolean; onFinalize: (otp: string) => Promise<void> }) {
  const { t } = useAccount();
  const p = t.payments;
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4" aria-live="polite">
      {next.kind === "wait" && <Banner tone="info">{p.wait}</Banner>}
      {next.kind === "redirect" && (
        <div className="space-y-3">
          <Banner tone="info">{p.redirect}</Banner>
          <a href={next.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-[0.95rem] text-paper">
            {p.redirectCta}
          </a>
        </div>
      )}
      {next.kind === "instructions" && (
        <Banner tone="info">
          <span className="block">{p.instructions}</span>
          <span className="mt-2 block whitespace-pre-line">{next.text}</span>
        </Banner>
      )}
      {next.kind === "pin" && (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await onFinalize(otp).finally(() => setBusy(false));
          }}
        >
          <p className="w-full text-[0.95rem]">{p.pin}</p>
          <Field label={p.pinLabel}>
            {(f) => <TextInput {...f} inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />}
          </Field>
          <Button type="submit" disabled={busy || otp.length < 4}>
            {p.pinSubmit}
          </Button>
        </form>
      )}
      {slow && <p className="text-[0.88rem] text-muted">{p.slow}</p>}
    </div>
  );
}

/** Rappel visible tant que la passerelle tourne en sandbox. */
export function SandboxNotice({ mode }: { mode: string | undefined }) {
  const { t } = useAccount();
  return mode === "sandbox" ? <Banner tone="warning">{t.payments.sandbox}</Banner> : null;
}
