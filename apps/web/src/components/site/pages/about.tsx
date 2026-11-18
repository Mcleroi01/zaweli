import type { Metadata } from "next";
import Link from "next/link";
import type { Locale } from "@zaweli/shared-types";
import { Reveal, SplitReveal } from "@/components/site/motion";
import { getDictionary } from "@/i18n/dictionaries";
import { alternatesFor, localePath } from "@/i18n/routing";

export function aboutMetadata(locale: Locale): Metadata {
  const t = getDictionary(locale).about;
  return { title: t.title, description: t.description, alternates: alternatesFor(locale, "/a-propos") };
}

export function AboutPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).about;
  return (
    <>
      <section className="pt-36 pb-20 sm:pt-44">
        <div className="mx-auto grid max-w-[84rem] gap-8 px-5 sm:px-8 lg:grid-cols-12">
          <p className="kicker text-muted lg:col-span-3 lg:pt-5">{t.kicker}</p>
          <div className="lg:col-span-9">
            <SplitReveal as="h1" immediate className="display text-[clamp(3rem,8vw,6.8rem)]">
              {t.heading}
            </SplitReveal>
            <Reveal>
              <p data-reveal className="mt-8 max-w-2xl text-[1.12rem] leading-relaxed text-muted sm:text-[1.2rem]">
                {t.lead}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-paper py-24 sm:py-32">
        <div className="mx-auto max-w-[84rem] px-5 sm:px-8">
          <div className="grid gap-6 lg:grid-cols-12">
            <p className="kicker text-muted lg:col-span-3">{t.beliefsKicker}</p>
            <SplitReveal className="display text-[clamp(2.4rem,5.4vw,4.6rem)] lg:col-span-9">{t.beliefsTitle}</SplitReveal>
          </div>
          <Reveal as="ol" className="mt-16 grid gap-x-10 gap-y-12 md:grid-cols-2">
            {t.beliefs.map((b, i) => (
              <li data-reveal key={b.title} className="border-t border-ink pt-6">
                <span className="font-display text-[1.1rem] italic text-primary">{String(i + 1).padStart(2, "0")}</span>
                <h2 className="display mt-4 text-[1.9rem]">{b.title}</h2>
                <p className="mt-3 max-w-md text-[1.02rem] leading-relaxed text-muted">{b.text}</p>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="py-24 sm:py-32">
        <div className="mx-auto grid max-w-[84rem] gap-12 px-5 sm:px-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="kicker text-muted">{t.notKicker}</p>
            <SplitReveal className="display mt-6 text-[clamp(2.4rem,4.6vw,3.8rem)]">{t.notTitle}</SplitReveal>
          </div>
          <Reveal as="ul" className="lg:col-span-6 lg:col-start-7">
            {t.not.map((item) => (
              <li data-reveal key={item} className="flex items-baseline gap-4 border-b border-line py-6 first:border-t">
                <span aria-hidden="true" className="text-gold">
                  —
                </span>
                <span className="display text-[1.7rem] text-ink/80">{item}</span>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="on-night bg-night text-paper">
        <div className="mx-auto flex max-w-[84rem] flex-col gap-10 px-5 py-24 sm:px-8 sm:py-28 lg:flex-row lg:items-end lg:justify-between">
          <SplitReveal className="display max-w-3xl text-[clamp(2.4rem,5vw,4.4rem)]">{t.endTitle}</SplitReveal>
          <Reveal className="flex flex-wrap items-center gap-6">
            <Link
              data-reveal
              href={localePath(locale, "/modeles/coffret/demo")}
              className="inline-flex h-13 items-center rounded-full bg-paper px-7 text-[0.98rem] text-ink transition-colors hover:bg-gold"
            >
              {t.openDemo}
            </Link>
            <Link data-reveal href={localePath(locale, "/contact")} className="link-draw inline-flex h-13 items-center text-[0.98rem]">
              {t.writeUs}
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
