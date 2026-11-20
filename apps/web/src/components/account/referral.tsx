"use client";

import { REFERRAL_PARAM } from "@zaweli/shared-types";
import { useCallback } from "react";
import { publicOrigin } from "@/account/client";
import { useAccount } from "@/account/session";
import { CopyButton, ErrorBanner, useResource } from "./dashboard";
import { formatMoney } from "./mobile-money";
import { QrCode } from "./qr-code";
import { Button, Card, formatDate, PageTitle } from "./ui";

/**
 * Parrainage (docs/13) : le lien personnel, la progression vers les paliers
 * et les cartes cadeaux gagnées. Les chiffres viennent de l'API ; un filleul
 * ne compte qu'après avoir payé sa première formule.
 */
export function ReferralView() {
  const { t, api, locale, path } = useAccount();
  const r = t.referral;
  const summary = useResource(useCallback(() => api.referral(), [api]));
  const data = summary.data;
  const link = data ? `${publicOrigin()}${path("/")}?${REFERRAL_PARAM}=${data.code}` : "";
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const pct = (rate: string) => `${Math.round(Number(rate) * 1000) / 10} %`;

  return (
    <div className="max-w-3xl space-y-10">
      <PageTitle title={r.title} lead={r.lead} />
      {summary.error && <ErrorBanner error={summary.error} onRetry={summary.reload} />}
      {data && (
        <>
          <Card className="space-y-5 p-6">
            <div>
              <p className="kicker text-muted">{r.yourLink}</p>
              <p className="mt-2 font-display text-[1.15rem] break-all">{link}</p>
              {data.refereeDiscountRate && <p className="mt-2 text-[0.9rem] text-muted">{r.welcome(pct(data.refereeDiscountRate))}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={link} label={t.common.copy} />
              {canShare && <Button onClick={() => void navigator.share({ url: link, text: r.shareText }).catch(() => undefined)}>{r.share}</Button>}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${r.shareText} ${link}`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-6 text-[0.95rem] hover:border-ink"
              >
                {t.publish.whatsapp}
              </a>
            </div>
            <div className="border-t border-line pt-5">
              <QrCode url={link} slug={`${r.qrSlug}-${data.code}`} />
            </div>
          </Card>

          <section className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <p className="kicker text-muted">{r.qualified}</p>
              <p className="mt-2 font-display text-[2.4rem] leading-none tabular-nums">{data.qualified}</p>
              <p className="mt-2 text-[0.85rem] text-muted">{r.qualifiedHelp}</p>
            </Card>
            <Card className="p-5">
              <p className="kicker text-muted">{r.pending}</p>
              <p className="mt-2 font-display text-[2.4rem] leading-none tabular-nums">{data.pending}</p>
              <p className="mt-2 text-[0.85rem] text-muted">{r.pendingHelp}</p>
            </Card>
          </section>

          {data.tiers.length > 0 && (
            <section aria-labelledby="paliers">
              <h2 id="paliers" className="kicker text-muted">
                {r.rewards}
              </h2>
              <ul className="mt-4 space-y-3">
                {data.tiers.map((tier) => {
                  const progress = Math.min(1, data.qualified / tier.threshold);
                  return (
                    <li key={tier.threshold}>
                      <Card className="p-5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-[1rem]">{r.tier(tier.threshold, formatMoney(tier.amount, tier.currency, locale))}</p>
                          <p className={`text-[0.88rem] ${tier.reached ? "text-success" : "text-muted"}`}>
                            {tier.reached ? r.reached : r.toGo(tier.threshold - data.qualified)}
                          </p>
                        </div>
                        <div
                          className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={tier.threshold}
                          aria-valuenow={Math.min(data.qualified, tier.threshold)}
                          aria-label={r.tier(tier.threshold, formatMoney(tier.amount, tier.currency, locale))}
                        >
                          <div className="h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-labelledby="cartes">
            <h2 id="cartes" className="kicker text-muted">
              {r.cards}
            </h2>
            {data.giftCards.length === 0 ? (
              <p className="mt-4 text-[0.95rem] text-muted">{r.noCards}</p>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {data.giftCards.map((c) => (
                  <li key={c.id}>
                    <Card className="p-5">
                      <p className="font-display text-[1.6rem]">{formatMoney(c.amount, c.currency, locale)}</p>
                      <p className="mt-1 text-[0.9rem]">{r.balance(formatMoney(c.balance, c.currency, locale), formatMoney(c.amount, c.currency, locale))}</p>
                      <p className="mt-1 text-[0.82rem] text-muted">
                        {formatDate(c.createdAt, locale)} · {r.cardHint}
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
