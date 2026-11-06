"use client";

/** Éléments partagés de Coffret : photo en arche, Continuer, son, perles. Repris de Pauline. */
import { useEffect, useState } from "react";
import { audioBus } from "@zaweli/template-engine/react";
import type { PublicPhoto } from "@zaweli/template-engine/schema";

export const GOLD = ["#f3d58d", "#d9ac55", "#b8862f", "#f7e7b5"];
export const FESTIVE = [...GOLD, "#a3182a", "#f6efe3", "#7a0f1e"];

export function ArchPhoto({ photo, className = "" }: { photo: PublicPhoto; className?: string }) {
  return (
    <div className={`frame-gold ${className}`}>
      <img
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        className="block aspect-[3/4] w-full rounded-t-full rounded-b-[4px] object-cover object-[50%_18%]"
      />
    </div>
  );
}

export function Continue({ label = "Continuer", onClick, className = "" }: { label?: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn-lux soft-pulse group inline-flex items-center gap-3 rounded-full border border-cf-gold/70 px-8 py-3.5 text-[16px] text-cf-gold ${className}`}
    >
      {label}
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function SoundToggle({ visible }: { visible: boolean }) {
  const [muted, setMuted] = useState(audioBus.isMuted());
  useEffect(() => audioBus.subscribe(setMuted), []);
  return (
    <button
      type="button"
      onClick={() => audioBus.toggle()}
      aria-label={muted ? "Activer le son" : "Couper le son"}
      className={`focus-ring fixed top-[calc(env(safe-area-inset-top)+12px)] right-4 z-[70] grid h-10 w-10 place-items-center rounded-full border border-cf-gold/40 bg-cf-ink/40 text-cf-gold backdrop-blur-md transition-opacity duration-700 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor" stroke="none" />
        {muted ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />}
      </svg>
    </button>
  );
}

/** Rangée de perles : combien de secrets restent à ouvrir. */
export function Pearls({ total, done, visible }: { total: number; done: number; visible: boolean }) {
  return (
    <div
      role="img"
      aria-label={`${done} étapes ouvertes sur ${total}`}
      className={`pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+26px)] z-[60] flex justify-center gap-2 transition-opacity duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-[7px] w-[7px] rounded-full transition-all duration-700 ${i < done ? "pearl-on scale-110" : "border border-cf-gold/45"}`} />
      ))}
    </div>
  );
}

/** Initiale du prénom pour le monogramme (R1 : plus de « P » écrit en dur). */
export const monogram = (name: string) => name.trim().charAt(0).toLocaleUpperCase("fr") || "♦";
