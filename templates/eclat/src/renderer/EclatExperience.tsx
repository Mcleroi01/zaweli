"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type ExperienceMode,
  ExperienceRuntimeProvider,
  lockScroll,
  scrollToTop,
  unlockScroll,
  useRuntime,
  useSmoothScroll,
} from "@zaweli/template-engine/react";
import type { PublicPayload } from "@zaweli/template-engine/schema";
import AchievementSection from "./AchievementSection.js";
import BirthdaySection from "./BirthdaySection.js";
import FinalSection from "./FinalSection.js";
import GallerySection from "./GallerySection.js";
import Intro from "./Intro.js";
import LetterSection from "./LetterSection.js";
import MagicSection from "./MagicSection.js";
import { ScrollTrigger } from "./motion.js";

/**
 * Orchestration d'Éclat, reprise du projet Fifi : une introduction en rideau,
 * puis un récit continu au défilement. Seules les sections activées par
 * l'expéditeur sont rendues.
 */
function Story() {
  const { isSectionEnabled } = useRuntime();
  const [showIntro, setShowIntro] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [introKey, setIntroKey] = useState(0);

  useSmoothScroll();

  useEffect(() => {
    if (!showIntro) return;
    lockScroll();
    return () => unlockScroll();
  }, [showIntro]);

  const handleReveal = useCallback(() => setRevealed(true), []);
  const handleDone = useCallback(() => {
    setShowIntro(false);
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }, []);
  const restart = useCallback(() => {
    setRevealed(false);
    setIntroKey((k) => k + 1);
    setShowIntro(true);
    requestAnimationFrame(() => scrollToTop());
  }, []);

  return (
    <>
      {showIntro && <Intro key={introKey} onReveal={handleReveal} onDone={handleDone} />}
      <main aria-hidden={showIntro && !revealed} inert={showIntro && !revealed ? true : undefined}>
        <BirthdaySection play={revealed} />
        {isSectionEnabled("achievement") && <AchievementSection />}
        {isSectionEnabled("gallery") && <GallerySection />}
        {isSectionEnabled("letter") && <LetterSection />}
        {isSectionEnabled("magic") && <MagicSection />}
        <FinalSection onRestart={restart} />
      </main>
    </>
  );
}

export function EclatExperience({ payload, mode }: { payload: PublicPayload; mode: ExperienceMode; storageKey?: string }) {
  return (
    <ExperienceRuntimeProvider payload={payload} mode={mode}>
      <div data-template="eclat" className="ec-root grain">
        <Story />
      </div>
    </ExperienceRuntimeProvider>
  );
}
