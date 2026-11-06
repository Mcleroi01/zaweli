"use client";

import { type MouseEvent, useEffect, useRef, useState } from "react";
import { confetti, gsap, reducedMotion, type StageProps, useField, useGSAP, useOptionalField } from "@zaweli/template-engine/react";
import type { PublicPhoto } from "@zaweli/template-engine/schema";
import { Balloon, type BalloonTint } from "./Balloon.js";
import { sound } from "./sound.js";
import { ArchPhoto, Continue, FESTIVE } from "./ui.js";

/** Position (en % de la scène), taille (px) et couleur des 8 ballons — design de Pauline. */
const BALLOONS: Array<{ left: number; top: number; size: number; tint: BalloonTint }> = [
  { left: 3, top: 4, size: 72, tint: "red" },
  { left: 74, top: 3, size: 80, tint: "gold" },
  { left: 41, top: 0, size: 60, tint: "ivory" },
  { left: 80, top: 30, size: 66, tint: "red" },
  { left: 1, top: 33, size: 70, tint: "gold" },
  { left: 70, top: 56, size: 72, tint: "ivory" },
  { left: 6, top: 62, size: 64, tint: "red" },
  { left: 44, top: 74, size: 76, tint: "gold" },
];
const TINT_COLORS: Record<BalloonTint, string[]> = {
  red: ["#a3182a", "#e0485c", "#f3d58d"],
  gold: ["#f3d58d", "#d9ac55", "#f7e7b5"],
  ivory: ["#f6efe3", "#ffffff", "#d9ac55"],
};

type Phase = "candle" | "lit" | "blown" | "party" | "done";

/** Bougie, vœu, puis la grande déclaration et les ballons à éclater. Animation identique à Pauline. */
export function Celebration({ onNext, showNext }: StageProps) {
  const root = useRef<HTMLElement>(null);
  const name = useField<string>("name");
  const age = useOptionalField<number>("age");
  const photo = useField<PublicPhoto>("celebrationPhoto");
  const wishes = useField<string[]>("wishes");
  const done = useField<string>("wishesDone");
  const [phase, setPhase] = useState<Phase>("candle");
  const [popped, setPopped] = useState<number[]>([]);
  const [floats, setFloats] = useState<Array<{ id: string; word: string; x: number; y: number }>>([]);
  const { contextSafe } = useGSAP({ scope: root });

  const light = contextSafe(() => {
    if (phase !== "candle") return;
    sound.sparkle();
    setPhase("lit");
  });

  const blow = contextSafe(() => {
    if (phase !== "lit") return;
    sound.blow();
    setPhase("blown");
    setTimeout(
      () => {
        setPhase("party");
        sound.fanfare();
        confetti.cannons(FESTIVE);
        setTimeout(() => sound.pop(), 250);
        setTimeout(() => sound.pop(), 520);
      },
      reducedMotion() ? 200 : 1300,
    );
  });

  // Entrée du titre et envol des ballons
  useGSAP(
    () => {
      if (phase !== "party") return;
      const q = gsap.utils.selector(root);
      const d = reducedMotion() ? 0.01 : 1;
      gsap.fromTo(
        q("[data-ttl]"),
        { opacity: 0, y: 30, filter: "blur(10px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.4 * d, stagger: 0.22, ease: "power3.out" },
      );
      q("[data-bal]").forEach((b, i) => {
        gsap.fromTo(
          b,
          { y: window.innerHeight * 1.15 },
          {
            y: 0,
            duration: (2.4 + Math.random()) * d,
            delay: 0.2 + i * 0.16 * d,
            ease: "power2.out",
            onComplete: () => {
              if (reducedMotion()) return;
              gsap.to(b, { y: "+=12", rotate: i % 2 ? 4 : -4, duration: 2 + Math.random(), yoyo: true, repeat: -1, ease: "sine.inOut" });
            },
          },
        );
      });
    },
    { scope: root, dependencies: [phase] },
  );

  const pop = contextSafe((i: number, e: MouseEvent<HTMLButtonElement>) => {
    if (popped.includes(i) || !root.current) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const s = root.current.getBoundingClientRect();
    sound.pop();
    confetti.burst({ x: r.left + r.width / 2, y: r.top + r.height * 0.35, count: 34, power: 7, colors: TINT_COLORS[BALLOONS[i]!.tint] });
    gsap.killTweensOf(el);
    gsap.to(el, { scale: 1.35, opacity: 0, duration: 0.16, ease: "power2.out" });
    const id = `${i}-${Date.now()}`;
    setFloats((f) => [...f, { id, word: wishes[i] ?? "", x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height * 0.35 }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 2200);
    setPopped((p) => [...p, i]);
  });

  // Tous les ballons éclatés : bouquet final
  useEffect(() => {
    if (phase !== "party" || popped.length < BALLOONS.length) return;
    const t = setTimeout(() => {
      setPhase("done");
      sound.fanfare();
      confetti.cannons(FESTIVE);
    }, 600);
    return () => clearTimeout(t);
  }, [phase, popped.length]);

  const party = phase === "party" || phase === "done";
  const n = popped.length;

  return (
    <section ref={root} className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 py-24 text-center">
      {!party && (
        <div className="flex flex-col items-center">
          <h2 className="font-cf-display text-[clamp(2.6rem,12vw,4.6rem)] leading-none text-cf-ivory">Il est temps.</h2>

          <button
            type="button"
            onClick={phase === "candle" ? light : blow}
            disabled={phase === "blown"}
            aria-label={phase === "candle" ? "Allumer la bougie" : "Souffler la bougie"}
            className="focus-ring relative mt-12 h-[240px] w-[140px]"
          >
            <span
              aria-hidden="true"
              className={`absolute top-[-30px] left-1/2 h-[200px] w-[200px] -translate-x-1/2 rounded-full blur-2xl transition-opacity duration-1000 ${phase === "lit" ? "opacity-100" : "opacity-0"}`}
              style={{ background: "radial-gradient(circle, rgb(255 205 120 / 0.55), transparent 65%)" }}
            />
            {phase === "lit" && (
              <span aria-hidden="true" className="flame absolute top-[10px] left-1/2 h-[50px] w-[24px]">
                <span className="flame-core" />
              </span>
            )}
            {phase === "blown" && (
              <span aria-hidden="true" className="absolute top-[20px] left-1/2 -translate-x-1/2">
                <span className="smoke" />
                <span className="smoke [animation-delay:0.25s]" />
                <span className="smoke [animation-delay:0.5s]" />
              </span>
            )}
            <span className="absolute top-[56px] left-1/2 h-[14px] w-[2px] -translate-x-1/2 bg-[#2a1a12]" />
            <span className="candle absolute top-[68px] left-1/2 h-[136px] w-[36px] -translate-x-1/2 rounded-[4px]" />
            <span className="gilt absolute bottom-[8px] left-1/2 h-[24px] w-[120px] -translate-x-1/2 rounded-[50%] shadow-[0_14px_24px_-8px_rgb(0_0_0/0.7)]" />
          </button>

          <p className="hint-breathe mt-8 min-h-[26px] text-[15px] text-cf-gold/85 italic">
            {phase === "candle" ? "Touche la mèche pour allumer la bougie" : phase === "lit" ? "Fais un vœu… puis souffle." : ""}
          </p>
          {phase === "lit" && (
            <button type="button" onClick={blow} className="btn-lux reveal-in mt-6 rounded-full border border-cf-gold/70 px-8 py-3.5 text-[16px] text-cf-gold">
              Souffler la bougie
            </button>
          )}
        </div>
      )}

      {party && (
        <>
          {/* R10 : le texte passe au-dessus des ballons (sans bloquer les clics). */}
          <div className="pointer-events-none relative z-30 flex w-full flex-col items-center">
            <div data-ttl className="w-[min(58vw,250px)] opacity-0">
              <ArchPhoto photo={photo} />
            </div>
            <p data-ttl className="foil -mt-6 font-cf-display text-[clamp(2.7rem,12.5vw,5.5rem)] leading-[0.95] opacity-0 [filter:drop-shadow(0_4px_18px_rgb(0_0_0/0.65))]">
              Joyeux anniversaire
            </p>
            <p data-ttl className="foil font-cf-display text-[clamp(4.4rem,23vw,10rem)] leading-[0.95] opacity-0 [filter:drop-shadow(0_4px_18px_rgb(0_0_0/0.65))]">
              {name}
            </p>
            {age !== undefined && (
              <p data-ttl className="mt-1 text-[17px] text-cf-gold italic opacity-0">
                {age} ans
              </p>
            )}
            <p data-ttl className="mt-8 max-w-[26ch] text-[17px] leading-[1.5] text-cf-ivory/80 italic opacity-0">
              {phase === "done" ? done : "Éclate les ballons : chacun cache un vœu pour toi."}
            </p>
            <p data-ttl className="mt-2 text-[13px] text-cf-gold/70 tabular-nums opacity-0">
              {n} {n > 1 ? "vœux" : "vœu"} sur {BALLOONS.length}
            </p>
            {n > 0 && (
              <ul className="mt-5 flex max-w-[22rem] flex-wrap justify-center gap-x-5 gap-y-1">
                {popped.map((i) => (
                  <li key={i} className="foil reveal-in font-cf-display text-[22px] italic">
                    {wishes[i]}
                  </li>
                ))}
              </ul>
            )}
            {phase === "done" && showNext && <Continue onClick={onNext} className="reveal-late pointer-events-auto mt-10" />}
          </div>

          <div className="pointer-events-none absolute inset-0 z-20">
            {BALLOONS.map((b, i) => (
              <button
                key={i}
                data-bal
                type="button"
                onClick={(e) => pop(i, e)}
                disabled={popped.includes(i)}
                aria-label={`Éclater le ballon ${i + 1}`}
                className={`absolute ${popped.includes(i) ? "pointer-events-none" : "pointer-events-auto"}`}
                style={{ left: `${b.left}%`, top: `${b.top}%`, width: b.size, height: b.size * 1.7, transform: "translateY(115vh)" }}
              >
                <Balloon tint={b.tint} id={i} />
              </button>
            ))}
            {floats.map((f) => (
              <span key={f.id} className="foil float-word absolute font-cf-display text-[26px] italic" style={{ left: f.x, top: f.y }}>
                {f.word}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
