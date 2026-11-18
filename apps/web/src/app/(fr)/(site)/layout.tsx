import { SiteChrome } from "@/components/site/site-chrome";

/** Site public en français : en-tête, défilement doux, pied de page. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome locale="fr">{children}</SiteChrome>;
}
