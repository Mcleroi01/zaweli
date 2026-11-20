import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CodeGate, LiveExperience, OpensLater } from "@/components/experience/live-experience";
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
  const state = await fetchPublicExperience(slug);
  if (!state) notFound();
  if (state.kind === "locked") return <CodeGate slug={slug} />;
  if (state.kind === "later") return <OpensLater availableFrom={state.availableFrom} />;
  return <LiveExperience slug={slug} experience={state.experience} />;
}

export default function ExperiencePage({ params }: PageProps<"/g/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-svh bg-[#2a0509]" aria-busy="true" />}>
      <Experience params={params} />
    </Suspense>
  );
}
