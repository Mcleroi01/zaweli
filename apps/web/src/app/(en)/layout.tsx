import { RootDocument, rootMetadata, rootViewport } from "@/components/site/root-document";

/** Mise en page racine de l'anglais (servi sous /en). */
export const metadata = rootMetadata("en");
export const viewport = rootViewport;

export default function EnglishRootLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument locale="en">{children}</RootDocument>;
}
