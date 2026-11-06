import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { PublicPayload } from "@zaweli/template-engine/schema";
import { ExperienceView } from "@/experiences/registry";
import { fetchPublicExperience } from "@/lib/api";

/**
 * Page du DESTINATAIRE : aucune interface du SaaS, seulement le template.
 * Aperçu de partage NEUTRE : il ne dévoile ni le prénom ni le contenu.
 */
export const metadata: Metadata = {
  title: "Une surprise t'attend",
  description: "Quelqu'un a préparé quelque chose pour toi.",
  robots: { index: false, follow: false },
  openGraph: { title: "Une surprise t'attend", description: "Quelqu'un a préparé quelque chose pour toi." },
};

async function Experience({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const experience = await fetchPublicExperience(slug);
  if (!experience) notFound();
  return (
    <ExperienceView
      rendererKey={experience.rendererKey}
      payload={experience.payload as unknown as PublicPayload}
      mode="live"
      storageKey={`zw:progress:${slug}`}
    />
  );
}

export default function ExperiencePage({ params }: PageProps<"/g/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-svh bg-[#2a0509]" aria-busy="true" />}>
      <Experience params={params} />
    </Suspense>
  );
}
