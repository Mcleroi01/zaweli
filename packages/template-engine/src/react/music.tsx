"use client";

import { audiusPageUrl, audiusStreamUrl, type Locale, type MusicChoice } from "@zaweli/shared-types";
import { useEffect, useRef, useState } from "react";

const TEXT = {
  fr: { play: "Lancer la musique", mute: "Couper la musique", by: "par", on: "sur Audius" },
  en: { play: "Play the music", mute: "Mute the music", by: "by", on: "on Audius" },
} satisfies Record<Locale, unknown>;

/**
 * Musique choisie par l'expéditeur (cahier des charges §11.1) :
 *  - jamais de démarrage automatique : le premier geste du destinataire la lance ;
 *  - un bouton la coupe ou la relance, avec le crédit de l'artiste (lien Audius) ;
 *  - l'expérience reste complète sans elle (échec de lecture silencieux).
 * Styles en ligne : le composant vit à l'intérieur de n'importe quel modèle.
 */
export function MusicLayer({ music, locale }: { music: MusicChoice; locale: Locale }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const muted = useRef(false);
  const t = TEXT[locale];

  useEffect(() => {
    const el = new Audio(audiusStreamUrl(music.trackId));
    el.loop = true;
    el.volume = 0.55;
    el.preload = "none";
    el.addEventListener("error", () => setFailed(true));
    el.addEventListener("play", () => setPlaying(true));
    el.addEventListener("pause", () => setPlaying(false));
    audio.current = el;
    // Premier geste n'importe où dans la page : c'est lui qui autorise le son.
    const start = () => {
      if (!muted.current) void el.play().catch(() => undefined);
    };
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      el.pause();
      el.src = "";
      audio.current = null;
    };
  }, [music.trackId]);

  if (failed) return null;
  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) {
      muted.current = false;
      void el.play().catch(() => undefined);
    } else {
      muted.current = true;
      el.pause();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        bottom: "max(12px, env(safe-area-inset-bottom))",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        gap: 8,
        maxWidth: "min(78vw, 340px)",
        padding: "6px 12px 6px 6px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.55)",
        color: "#fff",
        font: "500 12px/1.3 system-ui, sans-serif",
        backdropFilter: "blur(6px)",
      }}
    >
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={toggle}
        aria-label={playing ? t.mute : t.play}
        aria-pressed={playing}
        style={{ width: 32, height: 32, borderRadius: 999, border: 0, background: "rgba(255,255,255,0.18)", color: "#fff", fontSize: 14, cursor: "pointer", flexShrink: 0 }}
      >
        {playing ? "❚❚" : "♪"}
      </button>
      <a
        href={audiusPageUrl(music.permalink)}
        target="_blank"
        rel="noreferrer"
        onPointerDown={(e) => e.stopPropagation()}
        style={{ color: "#fff", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {music.title} <span style={{ opacity: 0.75 }}>{t.by} {music.artist} {t.on}</span>
      </a>
    </div>
  );
}
