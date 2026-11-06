import Link from "next/link";
import { Wordmark } from "./header";

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
          </div>
          <nav aria-label="Pied de page" className="grid grid-cols-2 gap-8 text-[0.95rem] md:col-span-6 md:grid-cols-3">
            <div className="flex flex-col gap-3">
              <span className="kicker text-night-muted">Découvrir</span>
              <Link href="/modeles" className="link-draw w-fit">Modèles</Link>
              <Link href="/#parcours" className="link-draw w-fit">L&apos;expérience</Link>
              <Link href="/tarifs" className="link-draw w-fit">Tarifs</Link>
            </div>
            <div className="flex flex-col gap-3">
              <span className="kicker text-night-muted">Essayer</span>
              <Link href="/modeles/coffret/demo" className="link-draw w-fit">Démo Coffret</Link>
              <Link href="/modeles/eclat/demo" className="link-draw w-fit">Démo Éclat</Link>
            </div>
            <div className="flex flex-col gap-3">
              <span className="kicker text-night-muted">Aide</span>
              <Link href="/questions" className="link-draw w-fit">Questions</Link>
              <Link href="/status" className="link-draw w-fit">État des services</Link>
            </div>
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
