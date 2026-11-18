import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@zaweli/shared-types";
import { getCatalog, specs } from "@/content/catalog";
import { FaqList } from "@/components/site/faq-list";
import { Journey, type JourneyStep } from "@/components/site/journey";
import { ImageReveal, Marquee, Parallax, Reveal, SplitReveal } from "@/components/site/motion";
import { Phone } from "@/components/site/phone";
import { getDictionary } from "@/i18n/dictionaries";
import { alternatesFor, localePath } from "@/i18n/routing";

/** Écrans du parcours, dans l'ordre des étapes du dictionnaire. */
const JOURNEY_SCREENS = [
  "/showcase/coffret-seal.webp",
  "/showcase/coffret-jewel.webp",
  "/showcase/coffret-riddle.webp",
  "/showcase/coffret-gifts.webp",
  "/showcase/coffret-party.webp",
  "/showcase/coffret-letter.webp",
];

export const homeMetadata = (locale: Locale): Metadata => ({ alternates: alternatesFor(locale, "/") });

export function HomePage({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.home;
  const sp = dict.specs;
  const href = (path: string) => localePath(locale, path);
  const journey: JourneyStep[] = t.journey.map((step, i) => ({
    title: step.title,
    text: step.text,
    screen: { src: JOURNEY_SCREENS[i] ?? JOURNEY_SCREENS[0]!, alt: step.alt },
  }));

  return (
    <>
      {/* ───────────── Ouverture ───────────── */}
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 lg:pt-44 lg:pb-28">
        <div className="mx-auto grid max-w-[84rem] grid-cols-1 gap-16 px-5 sm:px-8 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7 lg:pt-6">
            <Reveal>
              <p data-reveal className="kicker text-muted">
                {t.kicker}
              </p>
            </Reveal>
            <SplitReveal as="h1" immediate delay={0.1} className="display mt-7 text-[clamp(3.1rem,8.6vw,7.4rem)]">
              {t.title}
            </SplitReveal>
            <Reveal className="mt-9 max-w-[34rem]">
              <p data-reveal className="text-[1.12rem] leading-relaxed text-muted sm:text-[1.2rem]">
                {t.lead}
              </p>
              <div data-reveal className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href={href("/modeles")}
                  className="inline-flex h-13 items-center rounded-full bg-primary px-7 text-[0.98rem] text-paper transition-colors hover:bg-primary-hover"
                >
                  {t.discover}
                </Link>
                <Link href={href("/modeles/coffret/demo")} className="link-draw inline-flex h-13 items-center text-[0.98rem]">
                  {t.openDemo}
                </Link>
              </div>
            </Reveal>
          </div>

          <div className="relative h-[34rem] sm:h-[40rem] lg:col-span-5 lg:h-auto">
            <Parallax amount={6} className="absolute top-0 right-[6%] w-[52%] max-w-[17.5rem] sm:right-[14%] lg:right-[4%]">
              <Phone src="/showcase/coffret-seal.webp" alt={t.heroCoffretAlt} priority />
            </Parallax>
            <Parallax amount={14} className="absolute top-[22%] left-[2%] w-[48%] max-w-[16rem] sm:left-[12%] lg:left-0">
              <Phone src="/showcase/eclat-hero.webp" alt={t.heroEclatAlt} priority />
            </Parallax>
          </div>
        </div>

        <div className="mx-auto mt-20 max-w-[84rem] px-5 sm:px-8 lg:mt-28">
          <Reveal as="ul" className="grid grid-cols-1 border-t border-line sm:grid-cols-3">
            {t.proofs.map(([a, b]) => (
              <li data-reveal key={a} className="border-b border-line py-6 sm:border-b-0 sm:border-r sm:px-6 sm:first:pl-0 sm:last:border-r-0">
                <span className="block text-[1.02rem]">{a}</span>
                <span className="block text-[0.95rem] text-muted">{b}</span>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ───────────── Occasions ───────────── */}
      <section aria-label={t.occasionsLabel} className="border-y border-line bg-paper py-7">
        <Marquee items={t.occasions} className="display text-[2.2rem] italic text-ink/80 sm:text-[2.8rem]" />
      </section>

      {/* ───────────── Le parcours ───────────── */}
      <section id="parcours" className="scroll-mt-20 py-24 lg:py-0">
        <div className="mx-auto max-w-[84rem] px-5 sm:px-8 lg:pt-32">
          <div className="grid gap-6 lg:grid-cols-12">
            <p className="kicker text-muted lg:col-span-3">{t.journeyKicker}</p>
            <SplitReveal className="display text-[clamp(2.4rem,5.4vw,4.6rem)] lg:col-span-9">{t.journeyTitle}</SplitReveal>
          </div>
        </div>
        <div className="mt-16 lg:mt-0">
          <Journey steps={journey} />
        </div>
      </section>

      {/* ───────────── Les modèles ───────────── */}
      <section className="bg-paper py-24 sm:py-32">
        <div className="mx-auto max-w-[84rem] px-5 sm:px-8">
          <div className="grid gap-6 lg:grid-cols-12">
            <p className="kicker text-muted lg:col-span-3">{t.modelsKicker}</p>
            <div className="lg:col-span-9">
              <SplitReveal className="display text-[clamp(2.4rem,5.4vw,4.6rem)]">{t.modelsTitle}</SplitReveal>
              <Reveal>
                <p data-reveal className="mt-6 max-w-xl text-[1.08rem] leading-relaxed text-muted">
                  {t.modelsLead}
                </p>
              </Reveal>
            </div>
          </div>

          <div className="mt-20 space-y-28">
            {getCatalog(locale).map((tpl, i) => {
              const s = specs(tpl.manifest, locale);
              return (
                <article key={tpl.slug} className="grid items-center gap-12 lg:grid-cols-12">
                  <div className={`lg:col-span-6 ${i % 2 ? "lg:order-2 lg:col-start-7" : ""}`}>
                    <ImageReveal className="relative aspect-[5/4] rounded-[var(--radius-card)]">
                      <div className="absolute inset-0" style={{ background: tpl.tone.bg }}>
                        <div className="absolute inset-0 grid grid-cols-3 items-center gap-[4%] px-[7%]">
                          {tpl.screens.slice(0, 3).map((screen, k) => (
                            <div
                              key={screen.src}
                              className={`relative aspect-[390/844] overflow-hidden rounded-[1rem] shadow-[0_30px_60px_-25px_rgb(0_0_0/0.7)] ring-1 ring-white/10 ${k === 1 ? "-translate-y-[6%]" : "translate-y-[6%]"}`}
                            >
                              <Image src={screen.src} alt={screen.alt} fill sizes="(max-width: 1024px) 30vw, 200px" className="object-cover object-top" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </ImageReveal>
                  </div>
                  <Reveal className={`lg:col-span-5 ${i % 2 ? "lg:order-1 lg:col-start-1" : "lg:col-start-8"}`}>
                    <p data-reveal className="kicker text-muted">
                      {String(i + 1).padStart(2, "0")} — {tpl.occasion}
                    </p>
                    <h3 data-reveal className="display mt-4 text-[clamp(3rem,6vw,4.8rem)]">
                      {tpl.name}
                    </h3>
                    <p data-reveal className="mt-3 font-display text-[1.45rem] leading-snug italic text-ink/80">
                      {tpl.tagline}
                    </p>
                    <p data-reveal className="mt-6 text-[1.02rem] leading-relaxed text-muted">
                      {tpl.pitch}
                    </p>
                    <dl data-reveal className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-6 text-[0.95rem]">
                      <div>
                        <dt className="text-muted">{sp.photos}</dt>
                        <dd>{sp.upTo(s.maxPhotos)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">{sp.steps}</dt>
                        <dd>{s.steps.length}</dd>
                      </div>
                      {s.gifts && (
                        <div>
                          <dt className="text-muted">{sp.gifts}</dt>
                          <dd>{s.gifts.range}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-muted">{sp.optionalSections}</dt>
                        <dd>{s.optionalSections}</dd>
                      </div>
                    </dl>
                    <div data-reveal className="mt-9 flex flex-wrap gap-4">
                      <Link
                        href={href(`/modeles/${tpl.slug}/demo`)}
                        className="inline-flex h-12 items-center rounded-full bg-ink px-6 text-[0.95rem] text-paper transition-colors hover:bg-primary"
                      >
                        {t.openTheDemo}
                      </Link>
                      <Link href={href(`/modeles/${tpl.slug}`)} className="link-draw inline-flex h-12 items-center text-[0.95rem]">
                        {t.seeDetail}
                      </Link>
                    </div>
                  </Reveal>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────── Les cadeaux ───────────── */}
      <section className="on-night bg-night py-24 text-paper sm:py-32">
        <div className="mx-auto grid max-w-[84rem] gap-16 px-5 sm:px-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="kicker text-night-muted">{t.giftsKicker}</p>
            <SplitReveal className="display mt-6 text-[clamp(2.4rem,5vw,4.2rem)]">{t.giftsTitle}</SplitReveal>
            <Reveal>
              <p data-reveal className="mt-7 max-w-md text-[1.05rem] leading-relaxed text-night-muted">
                {t.giftsLead}
              </p>
            </Reveal>
          </div>
          <Reveal as="ol" className="lg:col-span-6 lg:col-start-7">
            {t.gifts.map((g, i) => (
              <li data-reveal key={g.name} className="grid grid-cols-[3rem_1fr] gap-4 border-b border-night-line py-7 first:border-t">
                <span className="font-display text-[1.1rem] text-gold italic">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="display text-[1.9rem]">{g.name}</h3>
                  <p className="mt-2 text-[1rem] text-night-muted">{g.example}</p>
                </div>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ───────────── Comment ça marche ───────────── */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-[84rem] px-5 sm:px-8">
          <div className="grid gap-6 lg:grid-cols-12">
            <p className="kicker text-muted lg:col-span-3">{t.howKicker}</p>
            <SplitReveal className="display text-[clamp(2.4rem,5.4vw,4.6rem)] lg:col-span-9">{t.howTitle}</SplitReveal>
          </div>
          <Reveal as="ol" className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
            {t.how.map(([title, text], i) => (
              <li data-reveal key={title} className="border-t border-ink pt-6">
                <span className="display block text-[4.5rem] leading-none text-primary">{i + 1}</span>
                <h3 className="display mt-6 text-[1.9rem]">{title}</h3>
                <p className="mt-3 text-[1.02rem] leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ───────────── Entreprises ───────────── */}
      <section className="border-y border-line bg-paper">
        <div className="mx-auto grid max-w-[84rem] items-center gap-8 px-5 py-16 sm:px-8 lg:grid-cols-12">
          <p className="kicker text-muted lg:col-span-3">{t.businessKicker}</p>
          <p className="display text-[clamp(1.7rem,3vw,2.4rem)] lg:col-span-6">{t.business}</p>
          <p className="text-[0.95rem] text-muted lg:col-span-3 lg:text-right">{t.businessWhen}</p>
        </div>
      </section>

      {/* ───────────── Questions ───────────── */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto grid max-w-[84rem] gap-12 px-5 sm:px-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="kicker text-muted">{t.faqKicker}</p>
            <SplitReveal className="display mt-6 text-[clamp(2.4rem,4.6vw,3.8rem)]">{t.faqTitle}</SplitReveal>
            <Link href={href("/questions")} className="link-draw mt-8 inline-block text-[0.98rem]">
              {t.allQuestions}
            </Link>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <FaqList items={dict.faq.slice(0, 5)} />
          </div>
        </div>
      </section>

      {/* ───────────── Fin ───────────── */}
      <section className="on-night relative overflow-hidden bg-primary text-paper">
        <div className="mx-auto max-w-[84rem] px-5 py-28 sm:px-8 sm:py-36">
          <SplitReveal className="display max-w-4xl text-[clamp(2.6rem,6.4vw,5.6rem)]">{t.endTitle}</SplitReveal>
          <Reveal className="mt-12 flex flex-wrap items-center gap-6">
            <Link
              data-reveal
              href={href("/modeles")}
              className="inline-flex h-13 items-center rounded-full bg-paper px-7 text-[0.98rem] text-primary transition-colors hover:bg-gold hover:text-ink"
            >
              {t.chooseModel}
            </Link>
            <span data-reveal className="text-[0.95rem] text-paper/70">
              {t.comingSoon}
            </span>
          </Reveal>
        </div>
      </section>
    </>
  );
}
