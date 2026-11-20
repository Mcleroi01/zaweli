"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { AdminMark } from "./login";
import { useAdmin } from "./providers";

const NAV = [
  { href: "/", label: "Tableau de bord", icon: "◧" },
  { href: "/carte", label: "Carte du monde", icon: "◍" },
  { href: "/revenus", label: "Revenus", icon: "▤" },
  { href: "/abonnements", label: "Abonnements", icon: "▦" },
  { href: "/calendrier", label: "Calendrier", icon: "▣" },
  { href: "/paiements", label: "Paiements", icon: "◈" },
  { href: "/utilisateurs", label: "Utilisateurs", icon: "◉" },
  { href: "/formules", label: "Formules et prix", icon: "◇" },
  { href: "/modeles", label: "Modèles", icon: "▧" },
  { href: "/moderation", label: "Modération", icon: "⚑" },
  { href: "/audit", label: "Journal d'audit", icon: "≡" },
] as const;

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { me, demo, signOut } = useAdmin();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav aria-label="Administration" className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[0.9rem] ${active ? "bg-raised font-medium text-ink" : "text-ink-2 hover:bg-raised hover:text-ink"}`}
          >
            <span aria-hidden="true" className="w-4 text-center text-muted">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col lg:p-4">
        <div className="px-3 py-2">
          <AdminMark />
        </div>
        <div className="mt-6 flex-1">{nav}</div>
        <div className="border-t border-line px-3 pt-4 text-[0.8rem]">
          <p className="truncate text-muted" title={me.email ?? undefined}>
            {me.email}
          </p>
          <button type="button" onClick={() => void signOut()} className="mt-2 text-ink-2 underline-offset-4 hover:underline">
            Se déconnecter
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
          <AdminMark />
          <button type="button" aria-expanded={open} aria-controls="admin-menu" onClick={() => setOpen((o) => !o)} className="h-9 rounded-lg border border-line px-3 text-sm">
            {open ? "Fermer" : "Menu"}
          </button>
        </header>
        {open && (
          <div id="admin-menu" className="border-b border-line bg-surface p-3 lg:hidden">
            {nav}
            <button type="button" onClick={() => void signOut()} className="mt-3 px-3 text-sm text-ink-2 underline-offset-4 hover:underline">
              Se déconnecter ({me.email})
            </button>
          </div>
        )}

        {demo && (
          <div role="status" className="border-b border-warn/40 bg-warn/15 px-4 py-2 text-center text-[0.85rem] sm:px-8">
            <strong>Données de démonstration</strong> — générées pour le développement, aucune n&apos;est réelle. Désactivé en production.
          </div>
        )}

        <main className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
