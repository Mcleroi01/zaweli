"use client";

import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger, reducedMotion, useGSAP } from "@zaweli/template-engine/react";

// SplitText est propre à Éclat (le moteur n'enregistre que ScrollTrigger).
if (typeof window !== "undefined") gsap.registerPlugin(SplitText);

export const prefersReducedMotion = reducedMotion;

/** Attend les polices avant de découper du texte (lignes justes). */
export const fontsReady = (): Promise<unknown> =>
  typeof document !== "undefined" && "fonts" in document ? document.fonts.ready : Promise.resolve();

export { gsap, ScrollTrigger, SplitText, useGSAP };
