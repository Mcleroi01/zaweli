"use client";

import type { MobileMoneyAccount, OrderResponse, PaymentOptionsResponse, PlanResponse } from "@zaweli/shared-types";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { ApiRequestError } from "@/account/client";
import { useAccount } from "@/account/session";
import { ErrorBanner, useResource } from "./dashboard";
import { formatMoney, MobileMoneyForm, PaymentNextStep, SandboxNotice, usePaymentPolling } from "./mobile-money";
import { Banner, ButtonLink, Card, EmptyState, formatDate, PageTitle, Select, StatusBadge } from "./ui";

const errorText = (err: unknown, fallback: string) => (err instanceof ApiRequestError && err.message ? err.message : fallback);

/** Suivi d'une commande jusqu'à la réponse du réseau (payée, échouée…). */
function OrderProgress({ initial, onRetry }: { initial: OrderResponse; onRetry: () => void }) {
  const { t, api, path, locale } = useAccount();
  const [order, setOrder] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => setOrder(await api.order(initial.id)), [api, initial.id]);
  const slow = usePaymentPolling(order.status === "pending", refresh);
  const amount = formatMoney(order.listAmount ?? order.amount, order.currency, locale);

  return (
    <Card className="space-y-5 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-display text-[1.4rem]">
          {order.plan.name} · {amount}
        </p>
        <StatusBadge status={order.status === "paid" ? "active" : order.status === "pending" ? "pending" : "expired"} label={t.orders.status[order.status]} />
      </div>
      {order.status === "pending" && order.next && (
        <PaymentNextStep
          next={order.next}
          slow={slow}
          onFinalize={async (otp) => {
            setError(null);
            try {
              setOrder(await api.finalizeOrder(order.id, otp));
            } catch (err) {
              setError(errorText(err, t.common.unavailable));
            }
          }}
        />
      )}
      {order.status === "paid" && (
        <div className="space-y-4">
          <Banner tone="success">{t.purchase.success}</Banner>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={path("/espace/creer")}>{t.purchase.create}</ButtonLink>
            <ButtonLink variant="secondary" href={path("/espace/licences")}>
              {t.purchase.seeLicenses}
            </ButtonLink>
          </div>
        </div>
      )}
      {order.status === "disputed" && <Banner tone="warning">{t.orders.disputedNote}</Banner>}
      {(order.status === "failed" || order.status === "cancelled" || order.status === "expired") && (
        <div className="space-y-3">
          <Banner tone="danger">{t.payments.failed}</Banner>
          <button type="button" onClick={onRetry} className="link-draw text-[0.95rem]">
            {t.payments.retry}
          </button>
        </div>
      )}
      {error && <Banner tone="danger">{error}</Banner>}
    </Card>
  );
}

function Checkout({ plan, options, onBack }: { plan: PlanResponse; options: PaymentOptionsResponse; onBack: () => void }) {
  const { t, api, locale, state } = useAccount();
  const router = useRouter();
  const payable = plan.prices.filter((p) => options.countries.some((c) => c.currencies.some((x) => x.code === p.currency)));
  const [currency, setCurrency] = useState(payable[0]?.currency ?? "");
  const [useCard, setUseCard] = useState(true);
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Une clé par tentative : deux clics sur « Payer » ne créent qu'une commande.
  const [attempt, setAttempt] = useState(() => crypto.randomUUID());
  const quote = useResource(useCallback(() => (currency ? api.quote(plan.code, currency) : Promise.resolve(null)), [api, plan.code, currency]));
  const profile = state.kind === "signed-in" ? state.profile : null;
  const q = quote.data;
  const hasCard = q ? Number(q.giftCardBalance) > 0 : false;
  const total = q ? (hasCard && useCard ? q.totalWithCredit : q.totalWithoutCredit) : null;
  const free = total !== null && Number(total) === 0;
  const money = (v: string) => formatMoney(v, currency, locale);

  if (order) {
    return (
      <OrderProgress
        initial={order}
        onRetry={() => {
          setOrder(null);
          setAttempt(crypto.randomUUID());
          router.replace("?");
        }}
      />
    );
  }

  const submit = async (payer?: MobileMoneyAccount) => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createOrder({ planCode: plan.code, currency, payer, useGiftCard: hasCard && useCard }, attempt);
      setOrder(created);
      router.replace(`?commande=${created.id}`);
    } catch (err) {
      setError(errorText(err, t.common.unavailable));
      setAttempt(crypto.randomUUID());
    }
    setBusy(false);
  };

  return (
    <Card className="space-y-5 p-6">
      <button type="button" onClick={onBack} className="link-draw text-[0.9rem] text-muted">
        {t.purchase.back}
      </button>
      <div>
        <p className="font-display text-[1.6rem]">{plan.name}</p>
        {plan.description && <p className="mt-1 text-[0.95rem] text-muted">{plan.description}</p>}
      </div>
      {payable.length > 1 && (
        <label className="block text-[0.9rem]">
          {t.purchase.currency}
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1.5">
            {payable.map((p) => (
              <option key={p.currency} value={p.currency}>
                {formatMoney(p.amount, p.currency, locale)}
              </option>
            ))}
          </Select>
        </label>
      )}
      {quote.error && <ErrorBanner error={quote.error} onRetry={quote.reload} />}
      {q && (
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-[0.95rem]">
          <dt className="text-muted">{t.purchase.price}</dt>
          <dd className="text-right tabular-nums">{money(q.listAmount)}</dd>
          {Number(q.discountAmount) > 0 && q.discountRate && (
            <>
              <dt className="text-muted">{t.purchase.discount(`${Math.round(Number(q.discountRate) * 1000) / 10} %`)}</dt>
              <dd className="text-right tabular-nums">−{money(q.discountAmount)}</dd>
            </>
          )}
          {hasCard && useCard && Number(q.creditAmount) > 0 && (
            <>
              <dt className="text-muted">{t.purchase.giftCard}</dt>
              <dd className="text-right tabular-nums">−{money(q.creditAmount)}</dd>
            </>
          )}
          <dt className="border-t border-line pt-1 font-medium">{t.purchase.total}</dt>
          <dd className="border-t border-line pt-1 text-right font-medium tabular-nums">{money(total!)}</dd>
        </dl>
      )}
      {q && hasCard && (
        <label className="flex min-h-11 items-center gap-3 text-[0.95rem]">
          <input type="checkbox" checked={useCard} onChange={(e) => setUseCard(e.target.checked)} className="h-5 w-5 accent-[var(--color-primary)]" />
          {t.purchase.useGiftCard(money(q.giftCardBalance))}
        </label>
      )}
      {q &&
        (free ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-[0.95rem] text-paper disabled:opacity-60"
          >
            {busy ? t.payments.sending : t.purchase.payWithCard}
          </button>
        ) : options.mode === "disabled" ? (
          <Banner tone="info">{t.payments.unavailable}</Banner>
        ) : (
          <MobileMoneyForm
            key={currency}
            currency={currency}
            locale={locale}
            defaultCountry={profile?.countryCode}
            busy={busy}
            submitLabel={busy ? t.payments.sending : t.payments.pay(money(total!))}
            labels={t.payments}
            onSubmit={(payer) => void submit(payer)}
          />
        ))}
      {error && <Banner tone="danger">{error}</Banner>}
    </Card>
  );
}

/** Achat d'une formule par mobile money (formules publiques, prix fixés par l'administration). */
export function PurchaseView() {
  const { t, api, locale, path } = useAccount();
  const router = useRouter();
  const params = useSearchParams();
  const resumeId = params.get("commande");
  const plans = useResource(useCallback(() => api.plans(), [api]));
  const options = useResource(useCallback(() => api.paymentOptions(), [api]));
  const resumed = useResource(useCallback(() => (resumeId ? api.order(resumeId) : Promise.resolve(null)), [api, resumeId]));
  const [chosen, setChosen] = useState<string | null>(params.get("formule"));
  const forSale = (plans.data ?? []).filter((p) => !p.isFree && p.prices.length > 0);
  const plan = forSale.find((p) => p.code === chosen);

  return (
    <div className="max-w-3xl space-y-8">
      <PageTitle title={t.purchase.title} lead={t.purchase.lead} />
      <SandboxNotice mode={options.data?.mode} />
      {(plans.error || options.error) && <ErrorBanner error={(plans.error ?? options.error)!} onRetry={plans.reload} />}
      {options.data?.mode === "disabled" && <Banner tone="info">{t.payments.unavailable}</Banner>}

      {resumed.data ? (
        <OrderProgress initial={resumed.data} onRetry={() => router.replace(path("/espace/acheter"))} />
      ) : plan && options.data ? (
        <Checkout plan={plan} options={options.data} onBack={() => setChosen(null)} />
      ) : (
        <section aria-labelledby="formules">
          <h2 id="formules" className="kicker text-muted">
            {t.purchase.plans}
          </h2>
          {plans.data && forSale.length === 0 && <p className="mt-4 text-[0.95rem] text-muted">{t.purchase.empty}</p>}
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {forSale.map((p) => (
              <li key={p.code}>
                <Card className="flex h-full flex-col p-5">
                  <p className="font-display text-[1.4rem]">{p.name}</p>
                  {p.description && <p className="mt-1 text-[0.9rem] text-muted">{p.description}</p>}
                  <ul className="mt-4 space-y-1 text-[0.9rem]">
                    <li>{t.purchase.creations(p.publicationsMax)}</li>
                    {p.recipientsMax != null && <li>{t.purchase.recipients(p.recipientsMax)}</li>}
                    {p.durationDays != null && <li>{t.purchase.days(p.durationDays)}</li>}
                  </ul>
                  <p className="mt-4 text-[1.05rem]">{p.prices.map((x) => formatMoney(x.amount, x.currency, locale)).join(" · ")}</p>
                  <div className="mt-auto pt-5">
                    <button
                      type="button"
                      disabled={!options.data}
                      onClick={() => setChosen(p.code)}
                      className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-[0.95rem] text-paper disabled:opacity-50"
                    >
                      {t.purchase.buy}
                    </button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Mes achats : commandes et leur statut, du plus récent au plus ancien. */
export function OrdersView() {
  const { t, api, locale, path } = useAccount();
  const orders = useResource(useCallback(() => api.orders(), [api]));
  return (
    <div className="space-y-8">
      <PageTitle title={t.orders.title} action={<ButtonLink href={path("/espace/acheter")}>{t.purchase.title}</ButtonLink>} />
      {orders.error && <ErrorBanner error={orders.error} onRetry={orders.reload} />}
      {orders.data?.length === 0 && <EmptyState title={t.orders.empty} />}
      <ul className="divide-y divide-line">
        {orders.data?.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-display text-[1.15rem]">
                {o.plan.name} · {formatMoney(o.listAmount ?? o.amount, o.currency, locale)}
              </p>
              <p className="mt-1 text-[0.85rem] text-muted">{formatDate(o.paidAt ?? o.createdAt, locale)}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={o.status === "paid" ? "active" : o.status === "pending" ? "pending" : "expired"} label={t.orders.status[o.status]} />
              {o.status === "pending" && (
                <Link href={`${path("/espace/acheter")}?commande=${o.id}`} className="link-draw text-[0.9rem]">
                  {t.orders.resume}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
