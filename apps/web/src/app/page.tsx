import Link from "next/link";
import { Badge, Button } from "@zaweli/ui";

/**
 * Accueil provisoire (phase 5 : fondation). La vraie page d'accueil (W1)
 * sera développée après validation de la direction visuelle U1.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8 px-4 py-16 sm:px-8">
      <div>
        <Badge tone="gold">Fondation technique · phase 5</Badge>
      </div>
      <h1 className="font-display text-4xl leading-tight sm:text-6xl">Offre un moment, pas seulement un message.</h1>
      <p className="max-w-2xl text-lg text-muted">
        ZAWELI permet de créer une expérience numérique unique — photos, mots, énigmes et cadeaux — et de la partager
        par un simple lien.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button disabled>Créer une surprise (bientôt)</Button>
        <Link
          href="/status"
          className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-5 text-sm font-medium hover:border-ink/40"
        >
          État des services
        </Link>
      </div>
    </main>
  );
}
