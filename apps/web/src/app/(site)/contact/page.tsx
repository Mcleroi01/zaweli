import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/site/contact-form";
import { Reveal, SplitReveal } from "@/components/site/motion";
import { CONTACT, mailto } from "@/content/contact";

export const metadata: Metadata = {
  title: "Contact",
  description: "Écrire à Zaweli : une question, de l'aide sur une création, ou une demande d'entreprise.",
};

const CHANNELS = [
  {
    kicker: "Questions et entreprises",
    address: CONTACT.general,
    text: "Une question sur les modèles, les formules, ou un projet pour ton entreprise.",
    subject: "Question sur Zaweli",
  },
  {
    kicker: "Aide",
    address: CONTACT.support,
    text: "Un souci avec une création, un lien qui ne s'ouvre pas, un paiement.",
    subject: "Demande d'aide",
  },
];

export default function ContactPage() {
  return (
    <>
      <section className="pt-36 pb-16 sm:pt-44">
        <div className="mx-auto grid max-w-[84rem] gap-8 px-5 sm:px-8 lg:grid-cols-12">
          <p className="kicker text-muted lg:col-span-3 lg:pt-5">(Contact)</p>
          <div className="lg:col-span-9">
            <SplitReveal as="h1" immediate className="display text-[clamp(3rem,8vw,6.8rem)]">
              Écris-nous, on te <em>répond</em>.
            </SplitReveal>
            <Reveal>
              <p data-reveal className="mt-8 max-w-xl text-[1.1rem] leading-relaxed text-muted">
                Avant d&apos;écrire, la réponse est peut-être déjà dans les{" "}
                <Link href="/questions" className="link-draw text-ink">
                  questions fréquentes
                </Link>
                .
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="pb-28">
        <div className="mx-auto grid max-w-[84rem] gap-14 px-5 sm:px-8 lg:grid-cols-12">
          <Reveal as="ul" className="lg:col-span-5">
            {CHANNELS.map((c) => (
              <li data-reveal key={c.address} className="border-t border-ink py-8">
                <span className="kicker block text-muted">{c.kicker}</span>
                <a href={mailto(c.address, c.subject)} className="display link-draw mt-4 inline-block text-[clamp(1.6rem,3vw,2.2rem)] break-all">
                  {c.address}
                </a>
                <p className="mt-3 max-w-sm text-[1rem] leading-relaxed text-muted">{c.text}</p>
              </li>
            ))}
          </Reveal>
          <div className="rounded-[var(--radius-card)] border border-line bg-paper p-6 sm:p-10 lg:col-span-6 lg:col-start-7">
            <h2 className="display text-[2rem]">Laisser un message</h2>
            <div className="mt-8">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
