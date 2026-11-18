import type { Metadata } from "next";
import Link from "next/link";
import type { Locale } from "@zaweli/shared-types";
import { Reveal, SplitReveal } from "@/components/site/motion";
import { getDictionary } from "@/i18n/dictionaries";
import { alternatesFor, localePath } from "@/i18n/routing";

export function pricingMetadata(locale: Locale): Metadata {
  const t = getDictionary(locale).pricing;
  return { title: t.title, description: t.description, alternates: alternatesFor(locale, "/tarifs") };
}

/** Règles reprises du cahier des charges (décisions déjà prises). AUCUN prix n'est affiché : ils ne sont pas encore fixés. */
export function PricingPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).pricing;
  return (
    <>
      <section className="pt-36 pb-16 sm:pt-44">
        <div className="mx-auto grid max-w-[84rem] gap-8 px-5 sm:px-8 lg:grid-cols-12">
          <p className="kicker text-muted lg:col-span-3 lg:pt-5">{t.kicker}</p>
          <div className="lg:col-span-9">
            <SplitReveal as="h1" immediate className="display text-[clamp(3rem,8vw,6.8rem)]">
              {t.heading}
            </SplitReveal>
            <Reveal>
              <p data-reveal className="mt-8 max-w-xl text-[1.1rem] leading-relaxed text-muted">
                {t.lead}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="pb-24">
        <Reveal as="ul" className="mx-auto grid max-w-[84rem] gap-5 px-5 sm:px-8 md:grid-cols-2 xl:grid-cols-4">
          {t.plans.map((p) => (
            <li
              data-reveal
              key={p.name}
              className={`flex flex-col rounded-[var(--radius-card)] border p-7 ${p.featured ? "on-night border-night bg-night text-paper" : "border-line bg-surface"}`}
            >
              <span className={`w-fit rounded-full px-3 py-1 text-[0.75rem] ${p.featured ? "bg-gold/20 text-gold" : "bg-ink/5 text-ink/70"}`}>{p.tag}</span>
              <h2 className="display mt-5 text-[2.1rem] [hyphens:none]">{p.name}</h2>
              <p className={`mt-3 text-[1rem] ${p.featured ? "text-night-muted" : "text-muted"}`}>{p.summary}</p>
              <p className="mt-8 font-display text-[1.35rem] italic">{t.priceLater}</p>
              <ul className={`mt-6 flex-1 space-y-3 border-t pt-6 text-[0.95rem] ${p.featured ? "border-night-line" : "border-line"}`}>
                {p.lines.map((l) => (
                  <li key={l} className="flex gap-3">
                    <span aria-hidden="true" className={p.featured ? "text-gold" : "text-primary"}>
                      —
                    </span>
                    {l}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </Reveal>
      </section>

      <section className="bg-paper py-24">
        <div className="mx-auto grid max-w-[84rem] gap-12 px-5 sm:px-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="kicker text-muted">{t.expiryKicker}</p>
            <SplitReveal className="display mt-6 text-[clamp(2.2rem,4.4vw,3.6rem)]">{t.expiryTitle}</SplitReveal>
          </div>
          <Reveal as="dl" className="grid gap-x-8 sm:grid-cols-2 lg:col-span-6 lg:col-start-7">
            {t.expiry.map(([k, v]) => (
              <div data-reveal key={k} className="border-t border-line py-6">
                <dt className="display text-[1.5rem]">{k}</dt>
                <dd className="mt-2 text-[0.98rem] text-muted">{v}</dd>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto flex max-w-[84rem] flex-col gap-6 px-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="display text-[clamp(1.8rem,3.4vw,2.8rem)]">{t.meanwhile}</p>
          <Link
            href={localePath(locale, "/modeles")}
            className="inline-flex h-13 w-fit items-center rounded-full bg-ink px-7 text-paper transition-colors hover:bg-primary"
          >
            {t.seeModels}
          </Link>
        </div>
      </section>
    </>
  );
}
