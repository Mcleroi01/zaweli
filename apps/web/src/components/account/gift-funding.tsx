"use client";

import type { GiftFundingResponse } from "@zaweli/shared-types";
import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/account/client";
import { useAccount } from "@/account/session";
import { formatMoney, MobileMoneyForm, PaymentNextStep, SandboxNotice, usePaymentPolling } from "./mobile-money";
import { Banner, Card } from "./ui";

const errorText = (err: unknown, fallback: string) => (err instanceof ApiRequestError && err.message ? err.message : fallback);

/**
 * Paiement d'un cadeau d'argent « via Zaweli » par l'expéditeur : montant
 * offert + frais, puis suivi jusqu'à la confirmation du réseau. Une fois payé,
 * le cadeau attend le destinataire (`onFunded` recharge le brouillon).
 */
export function GiftFundingPanel({ experienceId, giftId, onFunded }: { experienceId: string; giftId: string; onFunded: () => void }) {
  const { t, api, locale, state } = useAccount();
  const [funding, setFunding] = useState<GiftFundingResponse | null>(null);
  const [mode, setMode] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const profile = state.kind === "signed-in" ? state.profile : null;

  const refresh = useCallback(async () => {
    const next = await api.giftFunding(experienceId, giftId);
    setFunding(next);
    if (next.giftStatus !== "AWAITING_FUNDING") onFunded();
  }, [api, experienceId, giftId, onFunded]);

  useEffect(() => {
    let alive = true;
    void Promise.all([api.giftFunding(experienceId, giftId), api.paymentOptions()])
      .then(([f, o]) => {
        if (!alive) return;
        setFunding(f);
        setMode(o.mode);
      })
      .catch((err: unknown) => alive && setError(errorText(err, t.common.unavailable)));
    return () => {
      alive = false;
    };
  }, [api, experienceId, giftId, t.common.unavailable]);

  const open = funding?.transfer && (funding.transfer.status === "pending" || funding.transfer.status === "initiated");
  const slow = usePaymentPolling(Boolean(open), refresh);
  if (!funding) return error ? <Banner tone="danger">{error}</Banner> : null;
  const f = t.funding;
  const money = (v: string) => formatMoney(v, funding.currency, locale);

  return (
    <Card className="space-y-4 border-primary/30 p-5">
      <div>
        <p className="font-display text-[1.2rem]">{f.title}</p>
        <p className="mt-1 text-[0.9rem] text-muted">{f.lead}</p>
      </div>
      <SandboxNotice mode={mode} />
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-[0.95rem]">
        <dt className="text-muted">{f.amount}</dt>
        <dd className="text-right tabular-nums">{money(funding.amount)}</dd>
        <dt className="text-muted">{f.fee}</dt>
        <dd className="text-right tabular-nums">{money(funding.fee)}</dd>
        <dt className="border-t border-line pt-1 font-medium">{f.total}</dt>
        <dd className="border-t border-line pt-1 text-right font-medium tabular-nums">{money(funding.total)}</dd>
      </dl>
      <p className="text-[0.82rem] text-muted">{f.truth}</p>
      {open && funding.transfer?.next ? (
        <PaymentNextStep
          next={funding.transfer.next}
          slow={slow}
          onFinalize={async (otp) => {
            setError(null);
            try {
              setFunding(await api.finalizeGiftFunding(experienceId, giftId, otp));
            } catch (err) {
              setError(errorText(err, t.common.unavailable));
            }
          }}
        />
      ) : (
        <>
          {funding.transfer?.status === "failed" && <Banner tone="danger">{t.payments.failed}</Banner>}
          <MobileMoneyForm
            currency={funding.currency}
            locale={locale}
            defaultCountry={profile?.countryCode}
            busy={busy}
            submitLabel={busy ? t.payments.sending : t.payments.pay(money(funding.total))}
            labels={t.payments}
            onSubmit={async (payer) => {
              setBusy(true);
              setError(null);
              try {
                const next = await api.fundGift(experienceId, giftId, payer);
                setFunding(next);
                if (next.giftStatus !== "AWAITING_FUNDING") onFunded();
              } catch (err) {
                setError(errorText(err, t.common.unavailable));
              }
              setBusy(false);
            }}
          />
        </>
      )}
      {error && <Banner tone="danger">{error}</Banner>}
    </Card>
  );
}
