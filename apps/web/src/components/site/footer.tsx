import { SiteLink } from "./motion";
import { CONTACT, mailto } from "@/content/contact";
import { Wordmark } from "./header";

const COLUMNS = [
  {
    title: "Découvrir",
    links: [
      { href: "/modeles", label: "Modèles" },
      { href: "/#parcours", label: "L'expérience" },
      { href: "/tarifs", label: "Tarifs" },
    ],
  },
  {
    title: "Essayer",
    links: [
      { href: "/modeles/coffret/demo", label: "Démo Coffret" },
      { href: "/modeles/eclat/demo", label: "Démo Éclat" },
    ],
  },
  {
    title: "Zaweli",
    links: [
      { href: "/a-propos", label: "À propos" },
      { href: "/contact", label: "Contact" },
      { href: "/questions", label: "Questions" },
      { href: "/status", label: "État des services" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="on-night bg-night text-paper">
      <div className="mx-auto max-w-[84rem] px-5 pt-20 pb-10 sm:px-8">
        <div className="grid gap-12 border-b border-night-line pb-14 md:grid-cols-12">
          <div className="md:col-span-6">
            <Wordmark className="text-[2.6rem]" />
            <p className="mt-5 max-w-sm text-[0.98rem] leading-relaxed text-night-muted">
              Des expériences numériques à offrir, conçues par un studio, pour célébrer, surprendre ou remercier.
            </p>
            <a href={mailto(CONTACT.general)} className="link-draw mt-6 inline-block text-[0.98rem]">
              {CONTACT.general}
            </a>
          </div>
          <nav aria-label="Pied de page" className="grid grid-cols-2 gap-8 text-[0.95rem] md:col-span-6 md:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title} className="flex flex-col gap-3">
                <span className="kicker text-night-muted">{col.title}</span>
                {col.links.map((l) => (
                  <SiteLink key={l.href} href={l.href} className="link-draw w-fit">
                    {l.label}
                  </SiteLink>
                ))}
              </div>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-3 pt-8 text-[0.82rem] text-night-muted sm:flex-row sm:justify-between">
          <span>© 2026 Zaweli</span>
          <span>Les modèles sont conçus par le studio Zaweli.</span>
        </div>
      </div>
    </footer>
  );
}
