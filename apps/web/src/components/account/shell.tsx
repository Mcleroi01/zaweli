"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { RequireSession, useAccount } from "@/account/session";
import { Wordmark } from "@/components/site/header";
import { splitLocale } from "@/i18n/routing";
import { buttonClass } from "./ui";

type Item = { href: string; label: string; icon: ReactNode };

const icon = (d: string) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICONS = {
  home: icon("M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"),
  gift: icon("M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM3 7h18v4H3zM12 7v14M12 7S9.5 3 7.5 4.5 9 7 12 7zm0 0s2.5-4 4.5-2.5S15 7 12 7z"),
  people: icon("M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"),
  ticket: icon("M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4zM9 6v12"),
  user: icon("M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"),
  plus: icon("M12 5v14M5 12h14"),
};

/**
 * Tableau de bord (docs/05 §4.2) : barre latérale sur ordinateur, barre
 * d'onglets en bas sur mobile (Accueil, Expériences, +, Licences, Compte).
 */
export function AccountShell({ children }: { children: ReactNode }) {
  const { t, path, signOut, state } = useAccount();
  const { path: current } = splitLocale(usePathname());

  const items: Item[] = [
    { href: "/espace", label: t.nav.overview, icon: ICONS.home },
    { href: "/espace/experiences", label: t.nav.experiences, icon: ICONS.gift },
    { href: "/espace/destinataires", label: t.nav.recipients, icon: ICONS.people },
    { href: "/espace/licences", label: t.nav.licenses, icon: ICONS.ticket },
    { href: "/espace/compte", label: t.nav.settings, icon: ICONS.user },
  ];
  const active = (href: string) => (href === "/espace" ? current === "/espace" : current.startsWith(href));
  const email = state.kind === "signed-in" ? state.session.user.email : null;

  const tabs: Item[] = [
    { href: "/espace", label: t.nav.home, icon: ICONS.home },
    { href: "/espace/experiences", label: t.nav.experiencesShort, icon: ICONS.gift },
    { href: "/espace/creer", label: t.nav.create, icon: ICONS.plus },
    { href: "/espace/licences", label: t.nav.licenses, icon: ICONS.ticket },
    { href: "/espace/compte", label: t.nav.account, icon: ICONS.user },
  ];

  return (
    <RequireSession>
      <div className="min-h-svh bg-canvas lg:grid lg:grid-cols-[16.5rem_1fr]">
        <aside className="sticky top-0 hidden h-svh flex-col border-r border-line bg-paper px-5 py-6 lg:flex">
          <Link href={path("/")} className="rounded-sm px-2 focus-visible:outline-2 focus-visible:outline-primary">
            <Wordmark />
          </Link>
          <Link href={path("/espace/creer")} className={`${buttonClass.primary} mt-8 w-full`}>
            {ICONS.plus}
            {t.nav.newExperience}
          </Link>
          <nav aria-label={t.nav.menu} className="mt-8 flex flex-col gap-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={path(item.href)}
                aria-current={active(item.href) ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] transition-colors ${
                  active(item.href) ? "bg-primary/8 text-primary" : "text-ink/75 hover:bg-ink/5 hover:text-ink"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto border-t border-line pt-5">
            {email && <p className="truncate px-3 text-[0.82rem] text-muted">{email}</p>}
            <button type="button" onClick={signOut} className={`${buttonClass.quiet} mt-2 w-full justify-start`}>
              {t.nav.signOut}
            </button>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="flex items-center justify-between border-b border-line bg-paper px-5 py-4 lg:hidden">
            <Link href={path("/")}>
              <Wordmark />
            </Link>
            <button type="button" onClick={signOut} className="text-[0.88rem] text-muted">
              {t.nav.signOut}
            </button>
          </header>
          <main id="contenu" className="mx-auto max-w-[72rem] px-5 pt-8 pb-28 sm:px-8 lg:pt-12 lg:pb-16">
            {children}
          </main>
        </div>

        <nav
          aria-label={t.nav.menu}
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-paper/[0.98] pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          {tabs.map((tab) => {
            const create = tab.href === "/espace/creer";
            return (
              <Link
                key={tab.href}
                href={path(tab.href)}
                aria-current={active(tab.href) ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[0.7rem] ${active(tab.href) ? "text-primary" : "text-ink/65"}`}
              >
                <span className={create ? "grid h-9 w-9 place-items-center rounded-full bg-primary text-paper" : ""}>{tab.icon}</span>
                <span className={create ? "sr-only" : ""}>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </RequireSession>
  );
}
