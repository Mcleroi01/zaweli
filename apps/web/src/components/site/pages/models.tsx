import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@zaweli/shared-types";
import { getCatalog, specs } from "@/content/catalog";
import { ImageReveal, Reveal, SplitReveal } from "@/components/site/motion";
import { getDictionary } from "@/i18n/dictionaries";
import { alternatesFor, localePath } from "@/i18n/routing";

export function modelsMetadata(locale: Locale): Metadata {
  const t = getDictionary(locale).models;
  return { title: t.title, description: t.description, alternates: alternatesFor(locale, "/modeles") };
}

export function ModelsPage({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.models;
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

      <section className="pb-28">
        <ul className="mx-auto grid max-w-[84rem] gap-x-8 gap-y-20 px-5 sm:px-8 md:grid-cols-2">
          {getCatalog(locale).map((tpl, i) => {
            const s = specs(tpl.manifest, locale);
            return (
              <li key={tpl.slug} className={i % 2 ? "md:mt-28" : ""}>
                <Link
                  href={localePath(locale, `/modeles/${tpl.slug}`)}
                  className="group block focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-primary"
                >
                  <ImageReveal className="relative aspect-[4/5] rounded-[var(--radius-card)]">
                    <div className="absolute inset-0 transition-transform duration-[1.4s] ease-[var(--ease-out-soft)] group-hover:scale-[1.03]" style={{ background: tpl.tone.bg }}>
                      <div className="absolute inset-x-[22%] top-[9%] bottom-[-14%] overflow-hidden rounded-t-[1.6rem] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.7)] ring-1 ring-white/10">
                        <Image src={tpl.cover.src} alt={tpl.cover.alt} fill sizes="(max-width: 768px) 60vw, 360px" className="object-cover object-top" />
                      </div>
                    </div>
                  </ImageReveal>
                  <div className="mt-7 flex items-start justify-between gap-6">
                    <div>
                      <p className="kicker text-muted">{tpl.occasion}</p>
                      <h2 className="display mt-3 text-[3rem]">{tpl.name}</h2>
                      <p className="mt-2 max-w-sm font-display text-[1.2rem] leading-snug italic text-ink/75">{tpl.tagline}</p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="mt-4 grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line transition-colors duration-500 group-hover:border-primary group-hover:bg-primary group-hover:text-paper"
                    >
                      →
                    </span>
                  </div>
                  <p className="mt-5 text-[0.92rem] text-muted">{dict.specs.summary(s.maxPhotos, s.steps.length, s.gifts?.range ?? null)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
