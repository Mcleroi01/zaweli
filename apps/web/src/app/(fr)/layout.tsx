import { RootDocument, rootMetadata, rootViewport } from "@/components/site/root-document";

/** Mise en page racine du français (langue par défaut, servie à la racine du site). */
export const metadata = rootMetadata("fr");
export const viewport = rootViewport;

export default function FrenchRootLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument locale="fr">{children}</RootDocument>;
}
