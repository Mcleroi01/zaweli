"use client";

import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger, reducedMotion, useGSAP } from "@zaweli/template-engine/react";

// SplitText est propre à Éclat (le moteur n'enregistre que ScrollTrigger).
if (typeof window !== "undefined") gsap.registerPlugin(SplitText);

export const prefersReducedMotion = reducedMotion;

/**
 * Attend les polices avant de découper du texte (lignes justes), mais jamais
 * plus de 1,5 s : si `document.fonts.ready` tarde ou ne se résout pas, le
 * texte masqué doit quand même apparaître.
 */
export const fontsReady = (): Promise<unknown> =>
  typeof document !== "undefined" && "fonts" in document
    ? Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1500))])
    : Promise.resolve();

export { gsap, ScrollTrigger, SplitText, useGSAP };
