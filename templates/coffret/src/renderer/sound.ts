"use client";

import { audioBus } from "@zaweli/template-engine/react";

/**
 * Palette sonore de Coffret (« petits sons de bijouterie »), reprise à
 * l'identique de Pauline, jouée via le bus audio du moteur.
 */
export const sound = {
  unlock: () => audioBus.unlock(),

  /** Carillon clair : une découverte. */
  chime: () =>
    audioBus.play((t, { tone }) => {
      tone(1318.5, t, 1.4, 0.16);
      tone(1975.5, t + 0.09, 1.6, 0.11);
      tone(2637, t + 0.18, 1.2, 0.05);
    }),
  /** Petit scintillement : une bonne réponse. */
  sparkle: () =>
    audioBus.play((t, { tone }) => {
      [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, t + i * 0.06, 0.6, 0.07));
    }),
  /** Deux notes graves : ce n'est pas ça. */
  wrong: () =>
    audioBus.play((t, { tone }) => {
      tone(220, t, 0.25, 0.12, "triangle");
      tone(174.6, t + 0.13, 0.35, 0.12, "triangle");
    }),
  /** Le couvercle qui s'ouvre. */
  whoosh: () => audioBus.play((t, { noise }) => noise(t, 0.5, { gain: 0.25, freq: 700, q: 0.5, type: "lowpass" })),
  /** Un ballon qui éclate. */
  pop: () =>
    audioBus.play((t, { noise, ctx, out }) => {
      noise(t, 0.16, { gain: 0.9, freq: 1800, q: 0.7 });
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(190, t);
      o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.2);
    }),
  /** Bougie soufflée. */
  blow: () => audioBus.play((t, { noise }) => noise(t, 0.7, { gain: 0.3, freq: 500, q: 0.4, type: "lowpass" })),
  /** La grande célébration. */
  fanfare: () =>
    audioBus.play((t, { tone }) => {
      [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(f, t + i * 0.11, 1.6, 0.11, "triangle"));
      [1318.5, 1568, 2093].forEach((f, i) => tone(f, t + 0.5 + i * 0.08, 1.4, 0.06));
    }),
};
