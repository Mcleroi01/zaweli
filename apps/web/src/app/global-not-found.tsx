import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES } from "@zaweli/shared-types";
import { Wordmark } from "@/components/site/header";
import { RootDocument } from "@/components/site/root-document";
import { SITE_URL } from "@/content/site";
import { getDictionary } from "@/i18n/dictionaries";
import { localePath } from "@/i18n/routing";

/**
 * 404 des adresses qui ne correspondent à aucune page. Le site a une mise en page
 * racine par langue : celle-ci les remplace et s'affiche dans toutes les langues,
 * puisqu'une adresse inconnue ne dit pas laquelle choisir.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: LOCALES.map((l) => getDictionary(l).notFound.title).join(" · "),
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <RootDocument locale={DEFAULT_LOCALE}>
      <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-12 px-5 py-24 sm:px-8">
        <Wordmark className="text-[2.2rem]" />
        {LOCALES.map((l) => {
          const t = getDictionary(l).notFound;
          return (
            <section key={l} lang={l} className="border-t border-line pt-8">
              <h1 className="display text-[clamp(2.2rem,6vw,3.4rem)]">{t.title}</h1>
              <p className="mt-3 text-[1.02rem] text-muted">{t.text}</p>
              <a href={localePath(l, "/")} className="link-draw mt-6 inline-block text-[0.98rem]">
                {t.home} →
              </a>
            </section>
          );
        })}
      </main>
    </RootDocument>
  );
}
