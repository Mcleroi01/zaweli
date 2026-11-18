import type { Locale } from "@zaweli/shared-types";
import { SiteLink } from "./motion";
import { CONTACT, mailto } from "@/content/contact";
import { getDictionary, LANGUAGE_NAMES } from "@/i18n/dictionaries";
import { localePath } from "@/i18n/routing";
import { Wordmark } from "./header";
import { LocaleSwitch } from "./locale-switch";

export function SiteFooter({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.footer;
  const columns = t.columns.map((col, i) => ({
    title: col.title,
    links: [
      ...col.links.map((l) => ({ ...l, href: localePath(locale, l.href) })),
      // La page technique n'existe qu'en français.
      ...(i === t.columns.length - 1 ? [{ href: "/status", label: t.status }] : []),
    ],
  }));

  return (
    <footer className="on-night bg-night text-paper">
      <div className="mx-auto max-w-[84rem] px-5 pt-20 pb-10 sm:px-8">
        <div className="grid gap-12 border-b border-night-line pb-14 md:grid-cols-12">
          <div className="md:col-span-6">
            <Wordmark className="text-[2.6rem]" />
            <p className="mt-5 max-w-sm text-[0.98rem] leading-relaxed text-night-muted">{t.pitch}</p>
            <a href={mailto(CONTACT.general)} className="link-draw mt-6 inline-block text-[0.98rem]">
              {CONTACT.general}
            </a>
          </div>
          <nav aria-label={t.navLabel} className="grid grid-cols-2 gap-8 text-[0.95rem] md:col-span-6 md:grid-cols-3">
            {columns.map((col) => (
              <div key={col.title} className="flex flex-col gap-3">
                <span className="kicker text-night-muted">{col.title}</span>
                {col.links.map((l) => (
                  <SiteLink key={l.href} href={l.href} className="link-draw w-fit">
                    {l.label}
                  </SiteLink>
                ))}
              </div>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-3 pt-8 text-[0.82rem] text-night-muted sm:flex-row sm:items-center sm:justify-between">
          <span>{t.copyright}</span>
          <LocaleSwitch locale={locale} label={dict.language.label} names={LANGUAGE_NAMES} className="-my-2 text-paper" />
          <span>{t.studio}</span>
        </div>
      </div>
    </footer>
  );
}
