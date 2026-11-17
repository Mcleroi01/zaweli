"use client";

/**
 * Mouvements du site vitrine, avec GSAP. Volontairement retenus :
 * ils accompagnent la lecture et ne la retardent jamais. Tout est désactivé
 * si l'utilisateur préfère réduire les animations.
 */
import { type ComponentProps, type ElementType, type MouseEvent, type ReactNode, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { getLenis, reducedMotion, scrollToElement, ScrollTrigger, useGSAP, useSmoothScroll } from "@zaweli/template-engine/react";

if (typeof window !== "undefined") gsap.registerPlugin(SplitText, ScrollTrigger);

/**
 * Attend les polices, mais jamais plus de 1,5 s : si `document.fonts.ready`
 * tarde ou ne se résout pas (navigateur, préchargement, réseau), le texte
 * masqué doit quand même apparaître.
 */
const fontsReady = (): Promise<unknown> =>
  typeof document !== "undefined" && "fonts" in document
    ? Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1500))])
    : Promise.resolve();

/**
 * Défilement doux sur tout le site public.
 * À chaque changement de page, Lenis est recalé (haut de page, ou ancre #…) :
 * sinon il garde l'ancienne position et la page saute au premier tour de molette.
 */
export function SmoothScroll() {
  useSmoothScroll();
  const pathname = usePathname();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const lenis = getLenis();
      lenis?.resize();
      ScrollTrigger.refresh();
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (target) {
        if (lenis) lenis.scrollTo(target, { immediate: true, force: true });
        else target.scrollIntoView();
      } else if (lenis) {
        lenis.scrollTo(0, { immediate: true, force: true });
      } else {
        window.scrollTo(0, 0);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  return null;
}

/**
 * Lien du site. Vers une ancre de la page courante (« /#parcours » depuis l'accueil) :
 * défilement doux jusqu'à la section, au lieu du saut brutal du navigateur.
 */
export function SiteLink({ href, onClick, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const pathname = usePathname();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    const [path, id] = href.split("#");
    if (!id || (path || "/") !== pathname) return;
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    history.replaceState(null, "", `#${id}`);
    scrollToElement(target);
  };
  return <Link href={href} onClick={handle} {...props} />;
}

/**
 * Titre révélé ligne par ligne (masque). `immediate` : au chargement
 * (au-dessus de la ligne de flottaison) ; sinon à l'entrée dans l'écran.
 */
export function SplitReveal({
  as: Tag = "h2",
  className = "",
  children,
  immediate = false,
  delay = 0,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  immediate?: boolean;
  delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reducedMotion()) return;
      gsap.set(el, { autoAlpha: 0 });
      let split: SplitText | undefined;
      void fontsReady().then(() => {
        split = SplitText.create(el, { type: "lines", mask: "lines", linesClass: "split-mask" });
        gsap.set(el, { autoAlpha: 1 });
        gsap.from(split.lines, {
          yPercent: 108,
          duration: 1.25,
          stagger: 0.09,
          delay,
          ease: "expo.out",
          ...(immediate ? {} : { scrollTrigger: { trigger: el, start: "top 86%", once: true } }),
        });
      });
      return () => split?.revert();
    },
    { scope: ref },
  );
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

/** Les enfants marqués [data-reveal] apparaissent en fondu montant, en cascade. */
export function Reveal({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: ElementType }) {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (reducedMotion()) return;
      const items = gsap.utils.toArray<HTMLElement>("[data-reveal]", ref.current);
      if (!items.length) return;
      gsap.set(items, { autoAlpha: 0, y: 28 });
      ScrollTrigger.batch(items, {
        start: "top 90%",
        once: true,
        onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.08, ease: "power3.out" }),
      });
    },
    { scope: ref },
  );
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

/** Image dévoilée par un masque, avec un léger zoom arrière. */
export function ImageReveal({ children, className = "", from = "bottom" }: { children: ReactNode; className?: string; from?: "bottom" | "left" }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reducedMotion()) return;
      const start = from === "left" ? "inset(0% 100% 0% 0%)" : "inset(100% 0% 0% 0%)";
      gsap.fromTo(
        el,
        { clipPath: start },
        { clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "expo.inOut", scrollTrigger: { trigger: el, start: "top 88%", once: true } },
      );
      gsap.fromTo(el.firstElementChild, { scale: 1.12 }, { scale: 1, duration: 2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <div className="h-full w-full">{children}</div>
    </div>
  );
}

/** Décalage vertical léger au défilement (profondeur). */
export function Parallax({ children, className = "", amount = 8 }: { children: ReactNode; className?: string; amount?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (reducedMotion()) return;
      gsap.fromTo(
        ref.current,
        { yPercent: amount },
        { yPercent: -amount, ease: "none", scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true } },
      );
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Bandeau qui défile sans fin (contenu dupliqué, boucle sans couture). */
export function Marquee({ items, className = "" }: { items: string[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (reducedMotion()) return;
      const track = ref.current?.querySelector("[data-track]");
      if (!track) return;
      gsap.to(track, { xPercent: -50, duration: 42, ease: "none", repeat: -1 });
    },
    { scope: ref },
  );
  const row = (hidden: boolean) =>
    items.map((item, i) => (
      <span key={`${hidden}-${i}`} aria-hidden={hidden || undefined} className="flex items-center gap-10 pr-10">
        <span>{item}</span>
        <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
      </span>
    ));
  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <div data-track className="flex w-max whitespace-nowrap">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
