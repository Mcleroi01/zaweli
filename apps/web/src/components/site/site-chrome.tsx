import type { ReactNode } from "react";
import type { Locale } from "@zaweli/shared-types";
import { SiteFooter } from "./footer";
import { SiteHeader } from "./header";
import { SmoothScroll } from "./motion";
import { getDictionary, LANGUAGE_NAMES } from "@/i18n/dictionaries";

/** Site public : en-tête, défilement doux, pied de page (dans la langue de la page). */
export function SiteChrome({ locale, children }: { locale: Locale; children: ReactNode }) {
  const dict = getDictionary(locale);
  return (
    <>
      <SmoothScroll />
      <SiteHeader locale={locale} labels={dict.header} languageLabel={dict.language.label} languageNames={LANGUAGE_NAMES} />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
