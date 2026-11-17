"use client";

import Link from "next/link";
import { SiteLink } from "./motion";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Navigation principale, identique sur toutes les pages du site (Questions vit dans le pied de page). */
export const NAV = [
  { href: "/modeles", label: "Modèles" },
  { href: "/#parcours", label: "L'expérience" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/a-propos", label: "À propos" },
  { href: "/contact", label: "Contact" },
];

/** Une rubrique est active sur sa page et ses sous-pages (/modeles/coffret allume « Modèles »). */
const isActive = (pathname: string, href: string) =>
  !href.includes("#") && (pathname === href || pathname.startsWith(`${href}/`));

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-[1.45rem] leading-none tracking-[-0.02em] [font-variation-settings:'SOFT'_100,'WONK'_1] ${className}`}>
      Zaweli<span className="text-gold">.</span>
    </span>
  );
}

/**
 * En-tête : transparent en haut de page, papier en défilant, se retire
 * quand on descend et revient quand on remonte (la lecture reste libre).
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      setHidden(y > 240 && y > last.current);
      last.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("zw-locked", open);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[transform,background-color,border-color] duration-500 ease-[var(--ease-out-soft)] ${
        hidden && !open ? "-translate-y-full" : "translate-y-0"
      } ${scrolled || open ? "border-b border-line/80 bg-canvas/90 backdrop-blur-md" : "border-b border-transparent"}`}
    >
      <div className="mx-auto flex h-16 max-w-[84rem] items-center justify-between px-5 sm:px-8 lg:h-20">
        <Link href="/" aria-label="Zaweli, accueil" className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          <Wordmark />
        </Link>

        <nav aria-label="Navigation principale" className="hidden items-center gap-9 text-[0.92rem] lg:flex">
          {NAV.map((item) => (
            <SiteLink
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={`link-draw pb-0.5 ${isActive(pathname, item.href) ? "text-ink" : "text-ink/70 hover:text-ink"}`}
            >
              {item.label}
            </SiteLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/modeles/coffret/demo"
            className="hidden h-10 items-center rounded-full bg-ink px-5 text-[0.88rem] text-paper transition-colors hover:bg-primary sm:inline-flex"
          >
            Essayer une démo
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            className="relative grid h-11 w-11 place-items-center lg:hidden"
          >
            <span className={`absolute h-px w-5 bg-ink transition-transform duration-300 ${open ? "rotate-45" : "-translate-y-1"}`} />
            <span className={`absolute h-px w-5 bg-ink transition-transform duration-300 ${open ? "-rotate-45" : "translate-y-1"}`} />
          </button>
        </div>
      </div>

      <div
        id="menu-mobile"
        className={`overflow-hidden bg-canvas transition-[max-height] duration-500 ease-[var(--ease-out-soft)] lg:hidden ${open ? "max-h-[80svh]" : "max-h-0"}`}
      >
        <nav aria-label="Navigation mobile" className="flex flex-col px-5 pt-2 pb-8">
          {NAV.map((item, i) => (
            <SiteLink
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className="flex items-baseline gap-4 border-b border-line py-5"
            >
              <span className="kicker text-muted">0{i + 1}</span>
              <span className={`display text-[2.2rem] ${isActive(pathname, item.href) ? "text-primary" : ""}`}>{item.label}</span>
            </SiteLink>
          ))}
          <Link href="/modeles/coffret/demo" onClick={() => setOpen(false)} className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-ink text-paper">
            Essayer une démo
          </Link>
        </nav>
      </div>
    </header>
  );
}
