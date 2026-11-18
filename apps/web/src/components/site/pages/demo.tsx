import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEFAULT_LOCALE, type Locale } from "@zaweli/shared-types";
import { coffretDemoPayload } from "@zaweli/template-coffret";
import { eclatDemoPayload } from "@zaweli/template-eclat";
import type { PublicPayload } from "@zaweli/template-engine/schema";
import { ExperienceView } from "@/experiences/registry";
import { getDictionary, type TemplateSlug } from "@/i18n/dictionaries";
import { alternatesFor } from "@/i18n/routing";

/** Démonstrations publiques : contenu sous licence ZAWELI, jamais de photos personnelles. */
const DEMOS: Record<TemplateSlug, () => Promise<PublicPayload>> = {
  coffret: coffretDemoPayload,
  eclat: eclatDemoPayload,
};

const isDemo = (slug: string): slug is TemplateSlug => slug in DEMOS;

/**
 * Contenu figé : calculé une fois et mis en cache (prérendu statique).
 * Les contenus de démonstration n'existent qu'en français (ils viennent des modèles).
 */
async function demoPayload(slug: string): Promise<PublicPayload | null> {
  "use cache";
  return isDemo(slug) ? DEMOS[slug]() : null;
}

export const demoStaticParams = () => Object.keys(DEMOS).map((slug) => ({ slug }));

export function demoMetadata(locale: Locale, slug: string): Metadata {
  const t = getDictionary(locale).demo;
  if (!isDemo(slug)) return { title: t.fallbackTitle };
  const name = getDictionary(locale).catalog[slug].name;
  return { title: t.title(name), description: t.description(name), alternates: alternatesFor(locale, `/modeles/${slug}/demo`) };
}

export async function DemoPage({ locale, slug }: { locale: Locale; slug: string }) {
  const payload = await demoPayload(slug);
  if (!payload) notFound();
  const view = <ExperienceView rendererKey={payload.rendererKey} payload={payload} mode="demo" />;
  // Sur la version anglaise, le contenu du modèle reste en français : on le déclare comme tel.
  return locale === DEFAULT_LOCALE ? (
    view
  ) : (
    <div lang={DEFAULT_LOCALE} className="contents">
      {view}
    </div>
  );
}
