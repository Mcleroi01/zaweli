import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { catalog, specs } from "@/content/catalog";
import { ImageReveal, Reveal, SplitReveal } from "@/components/site/motion";

export const metadata: Metadata = {
  title: "Modèles",
  alternates: { canonical: "/modeles" },
  description: "Les modèles d'expériences Zaweli, conçus et animés par un studio. Ouvre leur démonstration.",
};

export default function ModelsPage() {
  return (
    <>
      <section className="pt-36 pb-16 sm:pt-44">
        <div className="mx-auto grid max-w-[84rem] gap-8 px-5 sm:px-8 lg:grid-cols-12">
          <p className="kicker text-muted lg:col-span-3 lg:pt-5">(Modèles)</p>
          <div className="lg:col-span-9">
            <SplitReveal as="h1" immediate className="display text-[clamp(3rem,8vw,6.8rem)]">
              Choisis <em>l&apos;écrin</em>, nous faisons le reste.
            </SplitReveal>
            <Reveal>
              <p data-reveal className="mt-8 max-w-xl text-[1.1rem] leading-relaxed text-muted">
                Chaque modèle a son décor, ses gestes et son rythme. Ouvre sa démonstration : tu verras exactement ce que
                découvrira la personne qui reçoit. D&apos;autres modèles sont en préparation.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="pb-28">
        <ul className="mx-auto grid max-w-[84rem] gap-x-8 gap-y-20 px-5 sm:px-8 md:grid-cols-2">
          {catalog.map((t, i) => {
            const s = specs(t.manifest);
            return (
              <li key={t.slug} className={i % 2 ? "md:mt-28" : ""}>
                <Link href={`/modeles/${t.slug}`} className="group block focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-primary">
                  <ImageReveal className="relative aspect-[4/5] rounded-[var(--radius-card)]">
                    <div className="absolute inset-0 transition-transform duration-[1.4s] ease-[var(--ease-out-soft)] group-hover:scale-[1.03]" style={{ background: t.tone.bg }}>
                      <div className="absolute inset-x-[22%] top-[9%] bottom-[-14%] overflow-hidden rounded-t-[1.6rem] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.7)] ring-1 ring-white/10">
                        <Image src={t.cover.src} alt={t.cover.alt} fill sizes="(max-width: 768px) 60vw, 360px" className="object-cover object-top" />
                      </div>
                    </div>
                  </ImageReveal>
                  <div className="mt-7 flex items-start justify-between gap-6">
                    <div>
                      <p className="kicker text-muted">{t.occasion}</p>
                      <h2 className="display mt-3 text-[3rem]">{t.name}</h2>
                      <p className="mt-2 max-w-sm font-display text-[1.2rem] leading-snug italic text-ink/75">{t.tagline}</p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="mt-4 grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line transition-colors duration-500 group-hover:border-primary group-hover:bg-primary group-hover:text-paper"
                    >
                      →
                    </span>
                  </div>
                  <p className="mt-5 text-[0.92rem] text-muted">
                    Jusqu&apos;à {s.maxPhotos} photos · {s.steps.length} étapes à remplir
                    {s.gifts ? ` · ${s.gifts.range} cadeaux` : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
