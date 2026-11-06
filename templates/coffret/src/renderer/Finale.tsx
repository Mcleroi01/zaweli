"use client";

import { useRef } from "react";
import { gsap, reducedMotion, type StageProps, useField, useGSAP, useOptionalField } from "@zaweli/template-engine/react";
import type { PublicPhoto } from "@zaweli/template-engine/schema";
import { ArchPhoto } from "./ui.js";

/** Le mot de la fin, signé. Animation identique à Pauline. */
export function Finale({ restart }: StageProps) {
  const root = useRef<HTMLElement>(null);
  const name = useField<string>("name");
  const from = useOptionalField<string>("from");
  const photo = useField<PublicPhoto>("finalePhoto");
  const line = useField<string>("finaleLine");
  const letter = useField<string>("finaleLetter");
  const signoff = useField<string>("finaleSignoff");

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      gsap.fromTo(q("[data-in]"), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: reducedMotion() ? 0.01 : 1.2, stagger: 0.25, delay: 0.4 });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative flex min-h-[100svh] flex-col items-center justify-center px-7 pt-24 pb-20 text-center">
      <div data-in className="w-[min(70vw,290px)]">
        <ArchPhoto photo={photo} />
      </div>
      <p data-in className="foil mt-8 font-cf-display text-[clamp(3.6rem,18vw,7rem)] leading-none">
        {name}
      </p>
      <p data-in className="mt-5 max-w-[20ch] font-cf-display text-[clamp(1.5rem,6.4vw,2.2rem)] leading-[1.22] text-cf-ivory italic">
        {line}
      </p>
      <div data-in aria-hidden="true" className="gold-line my-9 h-px w-16" />
      <p data-in className="max-w-[30ch] text-[17px] leading-[1.7] whitespace-pre-line text-cf-ivory/80">
        {letter}
      </p>
      <p data-in className="mt-8 text-[17px] text-cf-gold italic">
        {signoff}
        {from && <span className="mt-1 block text-cf-ivory/80 not-italic">{from}</span>}
      </p>
      <button data-in type="button" onClick={restart} className="focus-ring mt-14 text-[14px] text-cf-gold/80 underline underline-offset-8">
        Revivre la surprise
      </button>
    </section>
  );
}
