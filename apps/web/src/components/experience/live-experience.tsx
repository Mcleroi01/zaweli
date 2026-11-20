"use client";

import type { PublicExperienceResponse } from "@zaweli/shared-types";
import type { ExperienceServices } from "@zaweli/template-engine/react";
import type { PublicPayload } from "@zaweli/template-engine/schema";
import { type FormEvent, useMemo, useState } from "react";
import { ExperienceView } from "@/experiences/registry";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/[\s/.]+$/, "");

/** Code saisi par le destinataire, gardé pour l'onglet (pages de réception, déballage). */
export const accessCodeKey = (slug: string) => `zw:code:${slug}`;
export function storedAccessCode(slug: string): string | null {
  try {
    return sessionStorage.getItem(accessCodeKey(slug));
  } catch {
    return null;
  }
}

/** Services fournis au modèle : révélation d'un cadeau protégé au déballage. */
function servicesFor(slug: string): ExperienceServices {
  return {
    revealGift: async (giftId) => {
      const code = storedAccessCode(slug);
      const res = await fetch(`${API_URL}/v1/public/experiences/${encodeURIComponent(slug)}/gifts/${giftId}/reveal`, {
        method: "POST",
        headers: code ? { "x-access-code": code } : undefined,
      });
      if (!res.ok) return null;
      return ((await res.json()) as { data: Record<string, unknown> }).data;
    },
  };
}

/** L'expérience elle-même, côté destinataire. */
export function LiveExperience({ slug, experience }: { slug: string; experience: PublicExperienceResponse }) {
  const services = useMemo(() => servicesFor(slug), [slug]);
  return (
    <ExperienceView
      rendererKey={experience.rendererKey}
      payload={experience.payload as unknown as PublicPayload}
      mode="live"
      storageKey={`zw:progress:${slug}`}
      services={services}
    />
  );
}

/**
 * Expérience protégée par un code (choisi par l'expéditeur). Les textes sont
 * bilingues : la langue de l'expérience n'est connue qu'après ouverture.
 */
export function CodeGate({ slug }: { slug: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [experience, setExperience] = useState<PublicExperienceResponse | null>(null);

  if (experience) return <LiveExperience slug={slug} experience={experience} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/v1/public/experiences/${encodeURIComponent(slug)}/unlock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (res.status === 403) throw new Error("Ce n'est pas le bon code. · That is not the right code.");
      if (res.status === 429) throw new Error("Trop d'essais : réessaie dans une minute. · Too many tries: wait a minute.");
      if (!res.ok) throw new Error("Une erreur est survenue. · Something went wrong.");
      try {
        sessionStorage.setItem(accessCodeKey(slug), code.trim());
      } catch {
        // Navigation privée : le code sera redemandé au besoin.
      }
      setExperience((await res.json()) as PublicExperienceResponse);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  return (
    <main className="flex min-h-svh items-center justify-center bg-[#1c1412] px-5 text-[#f6f1e8]">
      <form onSubmit={submit} className="w-full max-w-sm text-center">
        <p className="text-[0.85rem] tracking-[0.2em] uppercase opacity-70">Une surprise t&apos;attend · A surprise awaits</p>
        <h1 className="mt-4 font-display text-[2rem] leading-tight">Entre le code que l&apos;on t&apos;a donné</h1>
        <p className="mt-1 text-[0.95rem] opacity-70">Enter the code you were given</p>
        <label htmlFor="code" className="sr-only">
          Code
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          maxLength={40}
          className="mt-8 h-14 w-full rounded-full border border-white/30 bg-white/10 px-6 text-center text-[1.2rem] tracking-widest outline-none focus:border-white"
        />
        <button type="submit" disabled={busy || !code.trim()} className="mt-4 h-12 w-full rounded-full bg-[#f6f1e8] text-[1rem] text-[#1c1412] disabled:opacity-50">
          {busy ? "…" : "Ouvrir · Open"}
        </button>
        {error && (
          <p role="alert" className="mt-4 text-[0.92rem] text-[#ffb4a8]">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}

/** Lien pas encore ouvert : date choisie par l'expéditeur. */
export function OpensLater({ availableFrom }: { availableFrom: string }) {
  const date = new Date(availableFrom);
  const fr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" }).format(date);
  const en = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short" }).format(date);
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#1c1412] px-5 text-center text-[#f6f1e8]">
      <div className="max-w-md">
        <p className="text-[0.85rem] tracking-[0.2em] uppercase opacity-70">Patience · Not yet</p>
        <h1 className="mt-4 font-display text-[2rem] leading-tight">Cette surprise s&apos;ouvrira le {fr}.</h1>
        <p className="mt-3 text-[0.95rem] opacity-70">This surprise opens on {en}.</p>
      </div>
    </main>
  );
}
