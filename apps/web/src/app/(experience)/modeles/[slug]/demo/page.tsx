import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { coffretDemoPayload } from "@zaweli/template-coffret";
import { eclatDemoPayload } from "@zaweli/template-eclat";
import type { PublicPayload } from "@zaweli/template-engine/schema";
import { ExperienceView } from "@/experiences/registry";

/** Démonstrations publiques : contenu sous licence ZAWELI, jamais de photos personnelles. */
const DEMOS: Record<string, () => Promise<PublicPayload>> = {
  coffret: coffretDemoPayload,
  eclat: eclatDemoPayload,
};

/** Contenu figé : calculé une fois et mis en cache (prérendu statique). */
async function demoPayload(slug: string): Promise<PublicPayload | null> {
  "use cache";
  const build = DEMOS[slug];
  return build ? build() : null;
}

export function generateStaticParams() {
  return Object.keys(DEMOS).map((slug) => ({ slug }));
}

const DEMO_NAMES: Record<string, string> = { coffret: "Coffret", eclat: "Éclat" };

export async function generateMetadata({ params }: PageProps<"/modeles/[slug]/demo">): Promise<Metadata> {
  const { slug } = await params;
  const name = DEMO_NAMES[slug];
  if (!name) return { title: "Démonstration" };
  return {
    title: `Démo ${name}`,
    description: `Ouvre la démonstration du modèle ${name} : exactement ce que verra la personne qui reçoit l'expérience.`,
    alternates: { canonical: `/modeles/${slug}/demo` },
  };
}

export default async function DemoPage({ params }: PageProps<"/modeles/[slug]/demo">) {
  const { slug } = await params;
  const payload = await demoPayload(slug);
  if (!payload) notFound();
  return <ExperienceView rendererKey={payload.rendererKey} payload={payload} mode="demo" />;
}
