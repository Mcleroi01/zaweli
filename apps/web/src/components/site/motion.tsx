"use client";

/**
 * Mouvements du site vitrine, avec GSAP. Volontairement retenus :
 * ils accompagnent la lecture et ne la retardent jamais. Tout est désactivé
 * si l'utilisateur préfère réduire les animations.
 */
import { type ElementType, type ReactNode, useRef } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { reducedMotion, ScrollTrigger, useGSAP, useSmoothScroll } from "@zaweli/template-engine/react";

if (typeof window !== "undefined") gsap.registerPlugin(SplitText, ScrollTrigger);

const fontsReady = () => (typeof document !== "undefined" && "fonts" in document ? document.fonts.ready : Promise.resolve());

/** Défilement doux sur tout le site public. */
export function SmoothScroll() {
  useSmoothScroll();
  return null;
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
