import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import { SITE_URL } from "@/content/site";
import "./globals.css";

const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"], display: "swap" });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const DESCRIPTION =
  "Zaweli met en scène tes mots, tes photos et tes cadeaux dans une expérience à ouvrir, conçue par un studio. Ton destinataire n'a qu'à toucher un lien.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Zaweli — Offre un moment, pas seulement un message", template: "%s · Zaweli" },
  description: DESCRIPTION,
  applicationName: "Zaweli",
  // Site public indexable. Les expériences privées (/g/…) gardent leur propre noindex.
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Zaweli",
    locale: "fr_FR",
    url: "/",
    title: "Zaweli — Offre un moment, pas seulement un message",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: "Zaweli — Offre un moment, pas seulement un message", description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#f6f1e8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${instrument.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
