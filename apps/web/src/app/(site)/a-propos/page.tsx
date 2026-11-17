import type { Metadata } from "next";
import Link from "next/link";
import { Reveal, SplitReveal } from "@/components/site/motion";

export const metadata: Metadata = {
  title: "À propos",
  description: "Zaweli conçoit des expériences numériques à offrir : un studio les dessine, tu les personnalises, ton destinataire les ouvre.",
};

/** Contenu tiré du cahier des charges (mission, principes, positionnement). Aucun fait inventé. */
const BELIEFS = [
  {
    title: "Un studio dessine, tu racontes",
    text: "Chaque modèle est une œuvre complète, conçue par l'équipe Zaweli : son décor, ses gestes, ses animations. Tu n'as rien à dessiner ni à mettre en page, seulement tes mots, tes photos et tes cadeaux.",
  },
  {
    title: "Celui qui reçoit n'a rien à faire",
    text: "Pas de compte, pas d'application à installer. Un lien ou un QR code suffit pour ouvrir l'expérience, sur téléphone d'abord.",
  },
  {
    title: "Privé, par lien",
    text: "Une expérience n'est pas publiée sur un réseau : elle n'est visible que par les personnes à qui tu envoies son lien.",
  },
  {
    title: "Une promesse reste une promesse",
    text: "Un cadeau décrit dans un paquet est annoncé comme tel. Zaweli n'affiche jamais un paiement ou un transfert qui n'a pas réellement eu lieu.",
  },
];

const NOT = ["Un éditeur de site à glisser-déposer", "Un générateur de cartes de vœux statiques", "Un réseau social"];

export default function AboutPage() {
  return (
    <>
      <section className="pt-36 pb-20 sm:pt-44">
        <div className="mx-auto grid max-w-[84rem] gap-8 px-5 sm:px-8 lg:grid-cols-12">
          <p className="kicker text-muted lg:col-span-3 lg:pt-5">(À propos)</p>
          <div className="lg:col-span-9">
            <SplitReveal as="h1" immediate className="display text-[clamp(3rem,8vw,6.8rem)]">
              Faire plaisir mérite mieux qu&apos;un <em>message</em> de plus.
            </SplitReveal>
            <Reveal>
              <p data-reveal className="mt-8 max-w-2xl text-[1.12rem] leading-relaxed text-muted sm:text-[1.2rem]">
                Zaweli permet à chacun de créer une expérience numérique unique pour célébrer, surprendre, remercier ou
                offrir un cadeau. La personne qui la reçoit l&apos;ouvre par un simple lien, et la découvre pas à pas.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-paper py-24 sm:py-32">
        <div className="mx-auto max-w-[84rem] px-5 sm:px-8">
          <div className="grid gap-6 lg:grid-cols-12">
            <p className="kicker text-muted lg:col-span-3">(Ce qui nous guide)</p>
            <SplitReveal className="display text-[clamp(2.4rem,5.4vw,4.6rem)] lg:col-span-9">
              Quatre <em>engagements</em>, tenus dans chaque modèle.
            </SplitReveal>
          </div>
          <Reveal as="ol" className="mt-16 grid gap-x-10 gap-y-12 md:grid-cols-2">
            {BELIEFS.map((b, i) => (
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
            <p className="kicker text-muted">(Ce que Zaweli n&apos;est pas)</p>
            <SplitReveal className="display mt-6 text-[clamp(2.4rem,4.6vw,3.8rem)]">
              Moins d&apos;outils, plus d&apos;<em>émotion</em>.
            </SplitReveal>
          </div>
          <Reveal as="ul" className="lg:col-span-6 lg:col-start-7">
            {NOT.map((item) => (
              <li data-reveal key={item} className="flex items-baseline gap-4 border-b border-line py-6 first:border-t">
                <span aria-hidden="true" className="text-gold">—</span>
                <span className="display text-[1.7rem] text-ink/80">{item}</span>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="on-night bg-night text-paper">
        <div className="mx-auto flex max-w-[84rem] flex-col gap-10 px-5 py-24 sm:px-8 sm:py-28 lg:flex-row lg:items-end lg:justify-between">
          <SplitReveal className="display max-w-3xl text-[clamp(2.4rem,5vw,4.4rem)]">
            Le mieux, c&apos;est encore <span className="whitespace-nowrap">de l&apos;<em>ouvrir</em>.</span>
          </SplitReveal>
          <Reveal className="flex flex-wrap items-center gap-6">
            <Link
              data-reveal
              href="/modeles/coffret/demo"
              className="inline-flex h-13 items-center rounded-full bg-paper px-7 text-[0.98rem] text-ink transition-colors hover:bg-gold"
            >
              Ouvrir une démo
            </Link>
            <Link data-reveal href="/contact" className="link-draw inline-flex h-13 items-center text-[0.98rem]">
              Nous écrire →
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
