import { SiteChrome } from "@/components/site/site-chrome";

/** Site public en anglais : en-tête, défilement doux, pied de page. */
export default function EnglishSiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome locale="en">{children}</SiteChrome>;
}
