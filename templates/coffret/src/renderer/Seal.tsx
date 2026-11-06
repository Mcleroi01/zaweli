"use client";

import { useRef, useState } from "react";
import { Dust, gsap, reducedMotion, useField, useGSAP } from "@zaweli/template-engine/react";
import { sound } from "./sound.js";
import { monogram } from "./ui.js";

/** L'enveloppe scellée : le tout premier écran. Animation identique à Pauline. */
export function Seal({ onOpen }: { onOpen: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(false);
  const name = useField<string>("name");
  const card = useField<string>("sealCard");
  const cta = useField<string>("sealCta");
  const initial = monogram(name);

  const { contextSafe } = useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      gsap.from(q("[data-in]"), { opacity: 0, y: 18, duration: 1.4, stagger: 0.25, delay: 0.3 });
    },
    { scope: root },
  );

  const breakSeal = contextSafe(() => {
    if (opened) return;
    setOpened(true);
    sound.unlock();
    sound.chime();
    const q = gsap.utils.selector(root);
    const d = reducedMotion() ? 0.01 : 1;
    gsap
      .timeline()
      .set(q("[data-hint]"), { animation: "none" }, 0)
      .to(q("[data-hint]"), { opacity: 0, duration: 0.3 }, 0)
      .to(q("[data-half=l]"), { x: -26, y: 40, rotate: -35, opacity: 0, duration: 0.9 * d, ease: "power2.in" }, 0)
      .to(q("[data-half=r]"), { x: 26, y: 46, rotate: 30, opacity: 0, duration: 0.9 * d, ease: "power2.in" }, 0)
      .to(q("[data-flap]"), { rotateX: 180, duration: 0.9 * d, ease: "power3.inOut" }, 0.25 * d)
      .set(q("[data-flap]"), { zIndex: 0 }, 0.7 * d)
      .to(q("[data-shadow]"), { opacity: 0, duration: 0.4 }, 0)
      .to(q("[data-card]"), { yPercent: -62, duration: 1 * d, ease: "power3.out" }, 0.95 * d)
      .set(q("[data-card]"), { zIndex: 5 }, 1.95 * d)
      .to(q("[data-flap]"), { opacity: 0, duration: 0.6 * d }, 1.95 * d)
      .to(q("[data-card]"), { yPercent: -6, scale: 1.12, duration: 1 * d, ease: "power3.inOut" }, 1.95 * d)
      .fromTo(q("[data-cta]"), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.8 }, 2.6 * d);
  });

  const enter = contextSafe(() => {
    sound.whoosh();
    gsap.to(root.current, { opacity: 0, scale: 1.04, duration: reducedMotion() ? 0.3 : 1, ease: "power2.inOut", onComplete: onOpen });
  });

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={`Enveloppe pour ${name}`}
      className="velvet fixed inset-0 z-[90] flex flex-col items-center justify-center overflow-hidden px-6"
    >
      <Dust density={3} />
      <h1 data-in className="foil relative font-cf-display text-[clamp(3rem,15vw,6rem)] leading-none">
        Pour {name}
      </h1>
      <p data-in className="relative mt-3 text-[17px] text-cf-ivory/70 italic">
        À n&apos;ouvrir que si tu es {name}.
      </p>

      <div data-in className="relative mt-14 [perspective:1100px]">
        <div className="relative aspect-[1.45] w-[min(80vw,330px)]">
          <div className="absolute inset-0 rounded-[6px] bg-[#e6d6bd] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.7)]" />
          <div
            data-card
            className="card-ivory absolute inset-x-[6%] top-[7%] bottom-[7%] z-[1] flex flex-col items-center justify-center rounded-[4px] px-5 text-center"
          >
            <span className="foil-dark font-cf-display text-[34px] leading-none">{initial}</span>
            <p className="mt-3 text-[14.5px] leading-[1.5] text-cf-ink/80 italic">{card}</p>
          </div>
          <div
            className="absolute inset-0 z-[2] rounded-[6px]"
            style={{ background: "linear-gradient(165deg, #efe3cf, #dcc8a8)", clipPath: "polygon(0 0, 50% 56%, 100% 0, 100% 100%, 0 100%)" }}
          />
          <div
            data-flap
            className="absolute inset-x-0 top-0 z-[3] h-[60%] origin-top"
            style={{ background: "linear-gradient(180deg, #e9d9bf, #d3bc98)", clipPath: "polygon(0 0, 100% 0, 50% 100%)", transformStyle: "preserve-3d" }}
          />
          <button
            type="button"
            onClick={breakSeal}
            disabled={opened}
            aria-label="Briser le sceau"
            className="focus-ring absolute top-[60%] left-1/2 z-[4] h-[68px] w-[68px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          >
            <span data-shadow className="absolute inset-0 rounded-full shadow-[0_6px_14px_rgb(0_0_0/0.45)]" />
            <span data-half="l" className="wax absolute inset-0 rounded-full [clip-path:inset(0_50%_0_0)]" />
            <span data-half="r" className="wax absolute inset-0 rounded-full [clip-path:inset(0_0_0_50%)]" />
            <span
              data-half="l"
              className="pointer-events-none absolute inset-0 grid place-items-center font-cf-display text-[32px] text-[#6b4413] [text-shadow:0_1px_0_rgb(255_240_200/0.6)]"
            >
              {initial}
            </span>
          </button>
        </div>
      </div>

      <div className="relative mt-12 grid place-items-center">
        <p data-hint className="hint-breathe text-[14px] text-cf-gold/80 [grid-area:1/1]">
          Touche le sceau
        </p>
        <button
          data-cta
          type="button"
          onClick={enter}
          className="btn-lux soft-pulse rounded-full border border-cf-gold/70 px-9 py-3.5 text-[16px] text-cf-gold opacity-0 [grid-area:1/1]"
          style={{ pointerEvents: opened ? "auto" : "none" }}
        >
          {cta}
        </button>
      </div>
    </div>
  );
}
