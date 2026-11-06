"use client";

import { type MouseEvent, useRef, useState } from "react";
import { confetti, gsap, reducedMotion, type StageProps, useGSAP, useRuntime } from "@zaweli/template-engine/react";
import type { PublicRiddle } from "@zaweli/template-engine/schema";
import { sound } from "./sound.js";
import { Continue, GOLD } from "./ui.js";

const ROMAN = ["I", "II", "III", "IV", "V"];

/**
 * Une carte gravée : la bonne réponse la retourne et révèle une photo.
 * Animation identique à Pauline. Changement (R3) : la bonne réponse n'est
 * plus en clair dans la page, elle est vérifiée par empreinte via le runtime.
 */
export function Riddle({ riddle, number, onNext, showNext }: StageProps & { riddle: PublicRiddle; number: number }) {
  const root = useRef<HTMLElement>(null);
  const { checkRiddle } = useRuntime();
  const [solved, setSolved] = useState(false);
  const [correct, setCorrect] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [hint, setHint] = useState(false);
  const [wrong, setWrong] = useState<number[]>([]);
  const { contextSafe } = useGSAP({ scope: root });

  const shake = contextSafe(() => {
    const q = gsap.utils.selector(root);
    gsap.to(q("[data-card]"), { keyframes: { x: [0, -12, 10, -7, 4, 0] }, duration: 0.5, ease: "none" });
  });

  const flip = contextSafe((target: HTMLElement) => {
    const q = gsap.utils.selector(root);
    const r = target.getBoundingClientRect();
    confetti.burst({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 40, power: 7, colors: GOLD });
    gsap
      .timeline()
      .to(q("[data-flip]"), { rotateY: 180, duration: reducedMotion() ? 0.01 : 1.2, ease: "power3.inOut", delay: 0.45 })
      .add(() => sound.chime(), "-=0.4");
  });

  const answer = async (i: number, e: MouseEvent<HTMLButtonElement>) => {
    if (solved || checking) return;
    const target = e.currentTarget;
    setChecking(true);
    const ok = await checkRiddle(number, riddle, i);
    setChecking(false);
    if (!ok) {
      sound.wrong();
      setHint(true);
      setWrong((w) => [...w, i]);
      shake();
      return;
    }
    setSolved(true);
    setCorrect(i);
    sound.sparkle();
    flip(target);
  };

  return (
    <section ref={root} className="relative flex min-h-[100svh] flex-col items-center justify-center px-5 py-24 text-center">
      <div data-card className="w-[min(88vw,370px)] [perspective:1400px]">
        <div data-flip className="grid [transform-style:preserve-3d]">
          {/* Recto : l'énigme */}
          <div className="card-ivory face relative rounded-[6px] px-6 pt-9 pb-7 [grid-area:1/1]">
            <div className="card-border" aria-hidden="true" />
            <h2 className="foil-dark font-cf-display text-[34px] leading-none">Énigme {ROMAN[number] ?? number + 1}</h2>
            <p className="mt-6 text-[19px] leading-[1.55] text-cf-ink/85 italic">{riddle.question}</p>
            <div className="mt-7 grid gap-2.5">
              {riddle.choices.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  onClick={(e) => void answer(i, e)}
                  disabled={solved || wrong.includes(i)}
                  className={`focus-ring rounded-full border px-5 py-3 text-[16px] transition-colors duration-300 ${
                    wrong.includes(i)
                      ? "border-cf-ink/10 text-cf-ink/30 line-through"
                      : correct === i
                        ? "border-[#b8862f] bg-[#b8862f] text-cf-ivory"
                        : "border-[#b8862f]/60 text-cf-ink active:bg-[#b8862f]/10"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <p
              aria-live="polite"
              className={`mt-4 min-h-[22px] text-[14px] text-cf-crimson italic transition-opacity duration-500 ${hint && !solved ? "opacity-100" : "opacity-0"}`}
            >
              {riddle.hint ?? "Essaie encore."}
            </p>
          </div>

          {/* Verso : la photo */}
          <div className="face back relative overflow-hidden rounded-[6px] [grid-area:1/1]">
            {riddle.photo ? (
              <img src={riddle.photo.src} alt={riddle.photo.alt} className="absolute inset-0 h-full w-full object-cover object-[50%_18%]" loading="lazy" />
            ) : (
              <div className="velvet absolute inset-0" />
            )}
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 45%, rgb(26 13 15 / 0.92) 100%)" }} />
            <div className="frame-inset" aria-hidden="true" />
            <p className="absolute inset-x-6 bottom-7 font-cf-display text-[clamp(1.4rem,6vw,1.9rem)] leading-[1.2] text-cf-ivory italic">
              {riddle.reveal}
            </p>
          </div>
        </div>
      </div>

      {solved && showNext && <Continue onClick={onNext} className="reveal-late mt-10" />}
    </section>
  );
}
