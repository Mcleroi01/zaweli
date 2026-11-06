"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import { gsap, reducedMotion, ScrollTrigger } from "./motion.js";

/** Défilement doux (Lenis), partagé par toute l'expérience. Repris de Pauline. */
let lenis: Lenis | null = null;

export const getLenis = () => lenis;

export function lockScroll() {
  document.documentElement.classList.add("zw-locked");
  lenis?.stop();
}

export function unlockScroll() {
  document.documentElement.classList.remove("zw-locked");
  lenis?.start();
}

export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
}

export function scrollToElement(el: HTMLElement) {
  if (lenis) {
    lenis.resize();
    lenis.scrollTo(el, { duration: 1.8, easing: (t: number) => 1 - Math.pow(1 - t, 4) });
  } else {
    el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
  }
}

/** Active Lenis pour la durée de vie du composant (désactivé si mouvement réduit). */
export function useSmoothScroll(enabled = true) {
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    if (!enabled || reducedMotion()) return;
    const instance = new Lenis({ lerp: 0.1 });
    lenis = instance;
    instance.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      instance.destroy();
      lenis = null;
    };
  }, [enabled]);
}
