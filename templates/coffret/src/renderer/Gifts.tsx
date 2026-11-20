"use client";

import { type MouseEvent, useRef, useState } from "react";
import { confetti, gsap, reducedMotion, type StageProps, useField, useGSAP, useRuntime } from "@zaweli/template-engine/react";
import { describeGift, type PublicGift } from "@zaweli/template-engine/schema";
import { sound } from "./sound.js";
import { Continue } from "./ui.js";

/** Habillage des paquets, repris de Pauline (cyclé si moins ou plus de 3 cadeaux). */
const WRAPS = [
  { box: "lacquer", ribbon: "#e2bf72" },
  { box: "paper-ivory", ribbon: "#a3182a" },
  { box: "gilt", ribbon: "#7a0f1e" },
];

/**
 * Paquets à déballer, branchés sur le SYSTÈME UNIVERSEL DE CADEAUX :
 * chaque paquet contient un cadeau typé (argent, objet, invitation, bon,
 * expérience). Le paquet et son animation restent ceux de Pauline ; le
 * ticket révélé affiche la formulation de vérité du moteur (describeGift).
 */
export function Gifts({ onNext, showNext }: StageProps) {
  const root = useRef<HTMLElement>(null);
  const title = useField<string>("giftsTitle");
  const gifts = useField<PublicGift[]>("gifts");
  const { locale, mode, services } = useRuntime();
  const [opened, setOpened] = useState<number[]>([]);
  // Code d'un bon cadeau : demandé à la page au moment du déballage, jamais avant (§9.4).
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const reveal = (gift: PublicGift) => {
    if (gift.type !== "VOUCHER" || !services.revealGift) return;
    void services
      .revealGift(gift.id)
      .then((data) => {
        if (typeof data?.code === "string") setSecrets((s) => ({ ...s, [gift.id]: data.code as string }));
      })
      .catch(() => undefined);
  };
  const { contextSafe } = useGSAP({ scope: root });

  const unwrap = contextSafe((i: number, e: MouseEvent<HTMLButtonElement>) => {
    if (opened.includes(i)) return;
    const box = e.currentTarget;
    const d = reducedMotion() ? 0.01 : 1;
    sound.whoosh();
    const q = gsap.utils.selector(box);
    gsap
      .timeline()
      .to(box, { keyframes: { rotate: [0, -6, 6, -3, 0] }, duration: 0.45 * d })
      .to(q("[data-bow]"), { y: -70, x: 30, rotate: 50, opacity: 0, duration: 0.7 * d, ease: "power2.in" })
      .to(q("[data-lid]"), { y: -60, rotate: -18, opacity: 0, duration: 0.7 * d, ease: "power2.out" }, "-=0.35")
      .add(() => {
        sound.chime();
        const r = box.getBoundingClientRect();
        confetti.burst({ x: r.left + r.width / 2, y: r.top + 10, count: 45, power: 8 });
        setOpened((o) => [...o, i]);
        reveal(gifts[i]!);
      });
  });

  const all = opened.length === gifts.length;
  const plural = gifts.length > 1;

  return (
    <section ref={root} className="relative flex min-h-[100svh] flex-col items-center justify-center px-5 py-24 text-center">
      <h2 className="max-w-[14ch] font-cf-display text-[clamp(2.1rem,9vw,3.6rem)] leading-[1.08] text-cf-ivory">{title}</h2>
      <p className={`hint-breathe mt-4 min-h-[21px] text-[14px] text-cf-gold/80 ${all ? "invisible" : ""}`}>
        {plural ? "Touche un paquet pour l'ouvrir" : "Touche le paquet pour l'ouvrir"}
      </p>

      <div className="mt-14 flex items-end justify-center gap-5">
        {gifts.map((gift, i) => {
          const wrap = WRAPS[i % WRAPS.length]!;
          const done = opened.includes(i);
          return (
            <button
              key={gift.id}
              type="button"
              onClick={(e) => unwrap(i, e)}
              disabled={done}
              aria-label={`Ouvrir le cadeau ${i + 1}`}
              className="focus-ring relative w-[min(26vw,104px)]"
              style={{ height: i === 1 ? 128 : 112 }}
            >
              <span className={`${wrap.box} absolute inset-x-[6%] top-[26%] bottom-0 rounded-[5px] shadow-[0_18px_28px_-12px_rgb(0_0_0/0.7)]`}>
                <span className="absolute inset-y-0 left-1/2 w-[14%] -translate-x-1/2" style={{ background: wrap.ribbon }} />
                {done && <span className="absolute inset-x-0 top-0 h-[16%] rounded-t-[5px] bg-black/35" />}
              </span>
              <span data-lid className={`${wrap.box} absolute inset-x-0 top-[16%] h-[16%] rounded-[4px] shadow-md`}>
                <span className="absolute inset-y-0 left-1/2 w-[14%] -translate-x-1/2" style={{ background: wrap.ribbon }} />
              </span>
              <span data-bow aria-hidden="true" className="absolute top-[3%] left-1/2 h-[18%] w-[56%] -translate-x-1/2">
                <span className="absolute top-0 left-0 h-full w-1/2 rounded-[50%_40%_40%_50%] border-[5px]" style={{ borderColor: wrap.ribbon, transform: "rotate(-14deg)" }} />
                <span className="absolute top-0 right-0 h-full w-1/2 rounded-[40%_50%_50%_40%] border-[5px]" style={{ borderColor: wrap.ribbon, transform: "rotate(14deg)" }} />
              </span>
            </button>
          );
        })}
      </div>

      <ul className="mt-12 grid w-[min(88vw,380px)] gap-4">
        {opened.map((i) => {
          const gift = gifts[i]!;
          const d = describeGift(gift, locale);
          return (
            <li key={gift.id} data-gift-type={gift.type} className="ticket reveal-in px-7 py-5 text-left">
              <span className="block text-[13px] text-[#8a6a2e] italic">{d.kicker}</span>
              <span className="mt-1 block font-cf-display text-[21px] leading-[1.3] text-cf-ink">{d.title}</span>
              {d.lines.map((line) => (
                <span key={line} className="mt-1 block text-[14px] leading-[1.45] text-cf-ink/75">
                  {line}
                </span>
              ))}
              {secrets[gift.id] && (
                <span className="mt-2 block font-mono text-[16px] tracking-wider text-cf-ink">
                  Code : {secrets[gift.id]}
                </span>
              )}
              {d.message && <span className="mt-2 block text-[15px] leading-[1.45] text-cf-ink/85 italic">« {d.message} »</span>}
              {d.note && <span className="mt-2 block text-[12px] leading-[1.4] text-[#8a6a2e]">{d.note}</span>}
              {d.action?.kind === "claim" &&
                (mode === "live" ? (
                  // Page de réception du site, à côté de l'expérience : /g/<lien>/recevoir/<cadeau>.
                  <a
                    href={`${window.location.pathname.replace(/\/+$/, "")}/recevoir/${gift.id}`}
                    className="focus-ring mt-3 inline-flex min-h-11 items-center rounded-full bg-cf-ink px-5 text-[14px] text-cf-ivory"
                  >
                    {d.action.label}
                  </a>
                ) : (
                  <span className="mt-3 inline-flex min-h-11 items-center rounded-full bg-cf-ink/60 px-5 text-[14px] text-cf-ivory">{d.action.label}</span>
                ))}
            </li>
          );
        })}
      </ul>

      {all && showNext && <Continue onClick={onNext} className="reveal-late mt-12" />}
    </section>
  );
}
