"use client";

import { useRef, useState } from "react";
import { gsap, reducedMotion, type StageProps, useField, useGSAP } from "@zaweli/template-engine/react";
import type { PublicPhoto } from "@zaweli/template-engine/schema";
import { sound } from "./sound.js";
import { ArchPhoto, Continue, monogram } from "./ui.js";

/** Un écrin laqué qui s'ouvre sur sa photo. Animation identique à Pauline. */
export function JewelBox({ onNext, showNext }: StageProps) {
  const root = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const name = useField<string>("name");
  const title = useField<string>("jewelTitle");
  const photo = useField<PublicPhoto>("jewelPhoto");
  const reveal = useField<string>("jewelReveal");
  const { contextSafe } = useGSAP({ scope: root });

  const openBox = contextSafe(() => {
    if (open) return;
    setOpen(true);
    sound.whoosh();
    const q = gsap.utils.selector(root);
    const d = reducedMotion() ? 0.01 : 1;
    gsap
      .timeline()
      .set(q("[data-hint]"), { animation: "none" }, 0)
      .to(q("[data-hint]"), { opacity: 0, duration: 0.3 }, 0)
      .to(q("[data-lid]"), { rotateX: -112, duration: 1.1 * d, ease: "power3.inOut" }, 0)
      .to(q("[data-glow]"), { opacity: 1, scale: 1.4, duration: 1 * d }, 0.5 * d)
      .add(() => sound.chime(), 0.8 * d)
      .to(q("[data-box]"), { scale: 0.6, y: 120, opacity: 0, duration: 0.9 * d, ease: "power2.in" }, 1.3 * d)
      .fromTo(q("[data-photo]"), { opacity: 0, scale: 0.5, y: 60 }, { opacity: 1, scale: 1, y: 0, duration: 1.4 * d, ease: "expo.out" }, 1.6 * d)
      .fromTo(q("[data-reveal]"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1 }, 2.3 * d);
  });

  return (
    <section ref={root} className="relative flex min-h-[100svh] flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-[15px] text-cf-gold/80 italic">Premier écrin</p>
      <h2 className="mt-2 max-w-[13ch] font-cf-display text-[clamp(2.3rem,10vw,4rem)] leading-[1.05] text-cf-ivory">{title}</h2>

      <div className="mt-12 grid w-full place-items-center">
        <button
          data-box
          type="button"
          onClick={openBox}
          disabled={open}
          aria-label="Ouvrir l'écrin"
          className="focus-ring relative h-[170px] w-[220px] [grid-area:1/1] [perspective:900px]"
        >
          <span
            data-glow
            aria-hidden="true"
            className="absolute top-[20%] left-1/2 h-40 w-56 -translate-x-1/2 rounded-full opacity-0 blur-2xl"
            style={{ background: "radial-gradient(circle, rgb(247 225 160 / 0.9), transparent 70%)" }}
          />
          <span className="lacquer absolute inset-x-0 bottom-0 h-[105px] rounded-[10px] shadow-[0_26px_40px_-16px_rgb(0_0_0/0.75)]">
            <span className="absolute inset-x-3 top-2 h-[34px] rounded-[6px] bg-[#2a0509] shadow-[inset_0_6px_14px_rgb(0_0_0/0.6)]" />
            <span className="gold-line absolute inset-x-0 top-[46px] h-[2px]" />
          </span>
          <span
            data-lid
            className="lacquer absolute inset-x-0 bottom-[100px] h-[66px] origin-bottom rounded-[10px] shadow-[0_-4px_14px_rgb(0_0_0/0.3)]"
            style={{ transformStyle: "preserve-3d" }}
          >
            <span className="foil absolute inset-0 grid place-items-center font-cf-display text-[34px]">{monogram(name)}</span>
            <span className="gold-line absolute inset-x-0 bottom-0 h-[2px]" />
          </span>
        </button>

        <div data-photo className="pointer-events-none w-[min(72vw,290px)] opacity-0 [grid-area:1/1]">
          <ArchPhoto photo={photo} />
        </div>
      </div>

      <div className="mt-10 grid place-items-center">
        <p data-hint className="hint-breathe text-[14px] text-cf-gold/80 [grid-area:1/1]">
          Touche l&apos;écrin pour l&apos;ouvrir
        </p>
        <p data-reveal className="max-w-[19ch] font-cf-display text-[clamp(1.5rem,6.4vw,2.2rem)] leading-[1.2] text-cf-ivory italic opacity-0 [grid-area:1/1]">
          {reveal}
        </p>
      </div>

      {open && showNext && <Continue onClick={onNext} className="reveal-late mt-10" />}
    </section>
  );
}
