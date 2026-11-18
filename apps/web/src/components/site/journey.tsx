"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap } from "gsap";
import { reducedMotion, ScrollTrigger, useGSAP } from "@zaweli/template-engine/react";

export type JourneyStep = { title: string; text: string; screen: { src: string; alt: string } };

/**
 * Le parcours du destinataire, scène par scène.
 * Ordinateur : la section est épinglée, le texte défile et l'écran du
 * téléphone change en fondu enchaîné. Mobile : une pile simple, lisible.
 */
export function Journey({ steps }: { steps: JourneyStep[] }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (reducedMotion()) return;
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const q = gsap.utils.selector(root);
        const screens = q("[data-screen]");
        const images = q("[data-screen] img");
        const items = q("[data-step]");
        const nums = q("[data-num]");
        const n = steps.length;
        // Durée d'une transition, en « étapes » de défilement : le reste du temps, l'écran est net et immobile.
        const T = 0.55;

        // Chaque écran recouvre le précédent par un rideau qui monte : jamais deux images superposées en fondu.
        gsap.set(screens.slice(1), { clipPath: "inset(100% 0% 0% 0%)" });
        // Les étapes sont superposées : seule l'étape en cours est visible (le bloc tient dans toute hauteur d'écran).
        gsap.set(items.slice(1), { autoAlpha: 0 });
        gsap.set(nums.slice(1), { opacity: 0.3 });

        const tl = gsap.timeline({
          defaults: { ease: "power2.inOut" },
          scrollTrigger: {
            trigger: q("[data-pin]")[0],
            start: "top top",
            end: () => `+=${window.innerHeight * (n - 0.5)}`,
            pin: true,
            // Lenis lisse déjà le défilement : un second lissage (scrub chiffré) donnait une sensation de retard.
            scrub: true,
            invalidateOnRefresh: true,
          },
        });
        steps.forEach((_, i) => {
          if (i === 0) return;
          const at = i - T / 2;
          tl.to(screens[i]!, { clipPath: "inset(0% 0% 0% 0%)", duration: T }, at)
            .fromTo(images[i]!, { scale: 1.08 }, { scale: 1, duration: T, ease: "power2.out" }, at)
            .to(images[i - 1]!, { scale: 0.96, duration: T }, at)
            // Le texte sort puis entre (jamais deux textes lisibles en même temps au même endroit).
            .to(items[i - 1]!, { autoAlpha: 0, duration: T / 2, ease: "power1.in" }, at)
            .to(items[i]!, { autoAlpha: 1, duration: T / 2, ease: "power1.out" }, at + T / 2)
            .to(nums[i - 1]!, { opacity: 0.3, duration: T }, at)
            .to(nums[i]!, { opacity: 1, duration: T }, at);
        });
        // Progression continue, sans à-coups.
        tl.fromTo(q("[data-progress]")[0]!, { scaleY: 1 / n }, { scaleY: 1, duration: n - 1, ease: "none" }, 0);
        tl.to({}, { duration: 0.5 });
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [steps.length] },
  );

  return (
    <div ref={root}>
      {/* Ordinateur : section épinglée */}
      {/* Hauteur = écran exact : texte et téléphone restent alignés et entiers, quelle que soit la hauteur de la fenêtre. */}
      <div data-pin className="hidden h-svh items-center pt-16 motion-reduce:h-auto motion-reduce:py-24 lg:flex lg:pt-20">
        <div className="mx-auto grid w-full max-w-[84rem] grid-cols-12 items-center gap-8 px-8">
          <div className="col-span-6 col-start-1 flex items-center gap-10 xl:col-span-5">
            {/* Repère : numéros et progression */}
            <div aria-hidden="true" className="relative flex h-[min(22rem,52svh)] shrink-0 gap-4">
              <span className="relative w-px bg-line">
                <span data-progress className="absolute inset-0 origin-top bg-primary" style={{ transform: `scaleY(${1 / steps.length})` }} />
              </span>
              <ol className="flex flex-col justify-between font-display text-[0.95rem] italic">
                {steps.map((step, i) => (
                  <li key={step.title} data-num className={i > 0 ? "opacity-30" : undefined}>
                    {String(i + 1).padStart(2, "0")}
                  </li>
                ))}
              </ol>
            </div>
            {/* Étapes superposées dans la même cellule de grille : la hauteur est celle de la plus longue. */}
            <ol className="grid max-w-md motion-reduce:gap-8">
              {steps.map((step, i) => (
                <li
                  key={step.title}
                  data-step
                  // Avant l'animation (et si l'utilisateur réduit les animations : liste simple, tout visible).
                  className={`[grid-area:1/1] motion-reduce:[grid-area:auto] ${i > 0 ? "invisible opacity-0 motion-reduce:visible motion-reduce:opacity-100" : ""}`}
                >
                  <span className="kicker text-muted">
                    ({String(i + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")})
                  </span>
                  <h3 className="display mt-3 text-[clamp(2rem,4.6svh,2.8rem)]">{step.title}</h3>
                  <p className="mt-4 text-[1.05rem] leading-relaxed text-muted">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="col-span-5 col-start-8 flex justify-center">
            <div className="relative aspect-[390/844] w-[min(21rem,31svh)] rounded-[2.4rem] bg-[#0e0a09] p-[0.55rem] shadow-[0_60px_120px_-50px_rgb(26_19_17/0.6)] ring-1 ring-black/10">
              <div className="relative h-full w-full overflow-hidden rounded-[1.9rem] bg-[#2a0509]">
                {steps.map((step, i) => (
                  <div key={step.screen.src} data-screen className="absolute inset-0 overflow-hidden will-change-[clip-path]" style={{ zIndex: i }}>
                    {/* Chargement différé par défaut : les écrans sont dans la vue (sous le rideau), ils se chargent dès l'arrivée de la section, et jamais sur mobile où ce bloc est masqué. */}
                    <Image
                      src={step.screen.src}
                      alt={step.screen.alt}
                      fill
                      sizes="360px"
                      priority={i === 0}
                      className="object-cover object-top will-change-transform"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile et tablette : pile simple */}
      <ol className="mx-auto max-w-xl space-y-16 px-5 lg:hidden">
        {steps.map((step, i) => (
          <li key={step.title} className="grid grid-cols-[1fr_8.5rem] items-center gap-6 sm:grid-cols-[1fr_11rem]">
            <div>
              <span className="kicker text-muted">({String(i + 1).padStart(2, "0")})</span>
              <h3 className="display mt-2 text-[1.5rem] sm:text-[1.75rem]">{step.title}</h3>
              <p className="mt-2 text-[0.98rem] leading-relaxed text-muted">{step.text}</p>
            </div>
            <div className="relative aspect-[390/844] rounded-[1.6rem] bg-[#0e0a09] p-1.5 shadow-[0_30px_60px_-30px_rgb(26_19_17/0.5)]">
              <div className="relative h-full w-full overflow-hidden rounded-[1.25rem]">
                <Image src={step.screen.src} alt={step.screen.alt} fill sizes="180px" className="object-cover object-top" />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ScrollTrigger doit être enregistré avant toute création d'épinglage.
if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);
