"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALES, type Locale } from "@zaweli/shared-types";
import { localePath, splitLocale } from "@/i18n/routing";

/**
 * Sélecteur FR / EN : mène à la même page dans l'autre langue.
 * Chaque langue a sa propre mise en page racine, le changement recharge donc la page.
 */
export function LocaleSwitch({
  locale,
  label,
  names,
  className = "",
}: {
  locale: Locale;
  /** Nom accessible du groupe (« Langue », « Language »). */
  label: string;
  /** Nom de chaque version, dans sa propre langue. */
  names: Record<Locale, string>;
  className?: string;
}) {
  const { path } = splitLocale(usePathname());
  return (
    <nav aria-label={label} className={`flex items-center gap-1 text-[0.8rem] tracking-[0.08em] uppercase ${className}`}>
      {LOCALES.map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 && (
            <span aria-hidden="true" className="opacity-40">
              /
            </span>
          )}
          {l === locale ? (
            <span aria-current="true" title={names[l]} className="px-1 py-2">
              {l}
            </span>
          ) : (
            <Link
              href={localePath(l, path)}
              hrefLang={l}
              lang={l}
              title={names[l]}
              aria-label={names[l]}
              className="px-1 py-2 opacity-60 transition-opacity hover:opacity-100"
            >
              {l}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
