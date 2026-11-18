import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Instrument_Sans } from "next/font/google";
import type { Locale } from "@zaweli/shared-types";
import { SITE_URL } from "@/content/site";
import { getDictionary } from "@/i18n/dictionaries";
import { localePath, OG_LOCALE } from "@/i18n/routing";
import "@/app/globals.css";

const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"], display: "swap" });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

/**
 * Document HTML commun aux deux mises en page racine (une par langue) :
 * c'est ce qui permet un <html lang> exact dès le rendu serveur, sans
 * réécriture d'adresse.
 */
export function rootMetadata(locale: Locale): Metadata {
  const { meta } = getDictionary(locale);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: meta.siteTitle, template: "%s · Zaweli" },
    description: meta.description,
    applicationName: "Zaweli",
    // Site public indexable. Les expériences privées (/g/…) gardent leur propre noindex.
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: "Zaweli",
      locale: OG_LOCALE[locale],
      url: localePath(locale, "/"),
      title: meta.siteTitle,
      description: meta.description,
    },
    twitter: { card: "summary_large_image", title: meta.siteTitle, description: meta.description },
  };
}

export const rootViewport: Viewport = {
  themeColor: "#f6f1e8",
  width: "device-width",
  initialScale: 1,
};

export function RootDocument({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <html lang={locale} className={`${instrument.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
