import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Locale } from "@zaweli/shared-types";
import { findTemplate, getCatalog, specs, TEMPLATE_SLUGS } from "@/content/catalog";
import { DemoFrame } from "@/components/site/demo-frame";
import { Reveal, SplitReveal } from "@/components/site/motion";
import { getDictionary } from "@/i18n/dictionaries";
import { alternatesFor, localePath } from "@/i18n/routing";

export const modelStaticParams = () => TEMPLATE_SLUGS.map((slug) => ({ slug }));

export function modelMetadata(locale: Locale, slug: string): Metadata {
  const t = findTemplate(locale, slug);
  return t ? { title: `${t.name} — ${t.occasion}`, description: t.tagline, alternates: alternatesFor(locale, `/modeles/${t.slug}`) } : {};
}

export function ModelPage({ locale, slug }: { locale: Locale; slug: string }) {
  const t = findTemplate(locale, slug);
  if (!t) notFound();
  const dict = getDictionary(locale);
  const m = dict.model;
  const sp = dict.specs;
  const s = specs(t.manifest, locale);
  const others = getCatalog(locale).filter((o) => o.slug !== t.slug);
  const href = (path: string) => localePath(locale, path);

  return (
    <>
      <section className="pt-32 pb-24 sm:pt-40">
        <div className="mx-auto grid max-w-[84rem] gap-16 px-5 sm:px-8 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-6">
            <Link href={href("/modeles")} className="link-draw text-[0.92rem] text-muted">
              {m.allModels}
            </Link>
            <p className="kicker mt-10 text-muted">{t.occasion}</p>
            <SplitReveal as="h1" immediate className="display mt-4 text-[clamp(4rem,11vw,9rem)]">
              {t.name}
            </SplitReveal>
            <Reveal>
              <p data-reveal className="mt-4 max-w-md font-display text-[1.6rem] leading-snug italic text-ink/80">
                {t.tagline}
              </p>
              <p data-reveal className="mt-8 max-w-lg text-[1.05rem] leading-relaxed text-muted">
                {t.pitch}
              </p>
              <div data-reveal className="mt-10 flex flex-wrap items-center gap-5">
                <Link
                  href={href(`/espace/creer/${t.slug}`)}
                  className="inline-flex h-13 items-center rounded-full bg-primary px-7 text-[0.98rem] text-paper transition-colors hover:bg-primary-hover"
                >
                  {m.create}
                </Link>
                <Link
                  href={href(`/modeles/${t.slug}/demo`)}
                  className="inline-flex h-13 items-center rounded-full border border-ink/20 px-7 text-[0.98rem] transition-colors hover:border-ink"
                >
                  {m.fullscreen}
                </Link>
                <span className="text-[0.92rem] text-muted">{m.orPlay}</span>
              </div>
            </Reveal>

            <Reveal as="dl" className="mt-16 grid grid-cols-2 border-t border-line text-[0.98rem]">
              {[
                [sp.photos, sp.upTo(s.maxPhotos)],
                [sp.steps, String(s.steps.length)],
                [sp.optionalSections, String(s.optionalSections)],
                ...(s.riddles ? [[sp.riddles, s.riddles]] : []),
                ...(s.gifts ? [[sp.gifts, s.gifts.range]] : []),
                [sp.writingHelp, sp.texts(s.aiFields)],
              ].map(([k, v]) => (
                <div data-reveal key={k} className="border-b border-line py-5 pr-4">
                  <dt className="text-muted">{k}</dt>
                  <dd className="mt-1 font-display text-[1.5rem]">{v}</dd>
                </div>
              ))}
            </Reveal>
          </div>

          <div className="lg:col-span-5 lg:col-start-8">
            <div className="mx-auto w-full max-w-[22rem] lg:sticky lg:top-28">
              <DemoFrame src={href(`/modeles/${t.slug}/demo`)} title={m.demoTitle(t.name)} />
              <p className="mt-4 text-center text-[0.85rem] text-muted">{m.demoNote}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-paper py-24">
        <div className="mx-auto max-w-[84rem] px-5 sm:px-8">
          <div className="grid gap-6 lg:grid-cols-12">
            <p className="kicker text-muted lg:col-span-3">{m.customizeKicker}</p>
            <SplitReveal className="display text-[clamp(2.2rem,4.6vw,3.8rem)] lg:col-span-9">{m.customizeTitle(s.steps.length)}</SplitReveal>
          </div>
          <Reveal as="ol" className="mt-14 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
            {s.steps.map((step, i) => (
              <li data-reveal key={step} className="flex items-baseline gap-4 border-t border-line py-5">
                <span className="font-display text-[1rem] text-primary italic">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[1.05rem]">{step}</span>
              </li>
            ))}
          </Reveal>
          {s.gifts && <p className="mt-10 max-w-2xl text-[0.98rem] leading-relaxed text-muted">{m.possibleGifts(s.gifts.types.join(", "))}</p>}
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-[84rem] px-5 sm:px-8">
          <Reveal as="ul" className="grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-4">
            {t.highlights.map((h, i) => {
              const screen = t.screens[(i + 1) % t.screens.length]!;
              return (
                <li data-reveal key={h.title}>
                  <div className="relative aspect-[390/600] overflow-hidden rounded-[var(--radius-card)]" style={{ background: t.tone.bg }}>
                    <Image src={screen.src} alt={screen.alt} fill sizes="(max-width: 768px) 90vw, 300px" className="object-cover object-top" />
                  </div>
                  <h3 className="display mt-6 text-[1.7rem]">{h.title}</h3>
                  <p className="mt-2 text-[0.98rem] leading-relaxed text-muted">{h.text}</p>
                </li>
              );
            })}
          </Reveal>
        </div>
      </section>

      {others.length > 0 && (
        <section className="border-t border-line py-20">
          <div className="mx-auto flex max-w-[84rem] flex-col gap-6 px-5 sm:flex-row sm:items-end sm:justify-between sm:px-8">
            <div>
              <p className="kicker text-muted">{m.another}</p>
              {others.map((o) => (
                <Link key={o.slug} href={href(`/modeles/${o.slug}`)} className="group mt-3 block">
                  <span className="display text-[clamp(3rem,7vw,5.5rem)] transition-colors group-hover:text-primary">{o.name} →</span>
                </Link>
              ))}
            </div>
            <p className="max-w-xs text-[0.95rem] text-muted">{others[0]!.tagline}</p>
          </div>
        </section>
      )}
    </>
  );
}
