"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useRuntime } from "./runtime.js";
import { lockScroll, scrollToElement, scrollToTop, unlockScroll, useSmoothScroll } from "./scroll.js";

export type StageProps = {
  /** Identifiant DOM de la scène (cible du défilement automatique). */
  domId: string;
  index: number;
  isLast: boolean;
  /** Vrai si cette scène est la dernière révélée : elle peut afficher « Continuer ». */
  showNext: boolean;
  onNext: () => void;
  restart: () => void;
};

export type RunnerSection = {
  /** Identifiant unique de la scène (ex. "riddles:1"). */
  id: string;
  /** Section du manifeste à laquelle appartient la scène (par défaut : id). */
  section?: string;
  render: (p: StageProps) => ReactNode;
};

type Props = {
  /** Scènes dans l'ordre du manifeste (hors écran d'entrée). */
  sections: RunnerSection[];
  /** Écran d'entrée (ex. l'enveloppe). Doit appeler onOpen après un geste. */
  renderGate: (p: { onOpen: () => void }) => ReactNode;
  /** Habillage persistant (progression, bouton son…). */
  renderChrome?: (p: { total: number; done: number; opened: boolean }) => ReactNode;
  /** Clé de mémorisation locale de la progression (aucune donnée envoyée au serveur). */
  storageKey?: string;
  children?: ReactNode;
};

const readProgress = (key?: string) => {
  if (!key) return 0;
  try {
    const n = Number(window.localStorage.getItem(key));
    return Number.isInteger(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
};

const writeProgress = (key: string | undefined, step: number) => {
  if (!key) return;
  try {
    if (step > 0) window.localStorage.setItem(key, String(step));
    else window.localStorage.removeItem(key);
  } catch {
    // Stockage indisponible (navigation privée) : on continue sans mémoriser.
  }
};

/**
 * Moteur d'étapes générique, issu de la machine à étapes de Pauline :
 * - seules les scènes 0..step sont montées (la surprise n'est pas dans le DOM) ;
 * - les sections masquées par l'expéditeur sont sautées ;
 * - la progression est mémorisée localement (un rechargement ne fait pas tout recommencer) ;
 * - défilement automatique vers la scène révélée, redémarrage possible.
 */
export function ExperienceRunner({ sections, renderGate, renderChrome, storageKey, children }: Props) {
  const { isSectionEnabled } = useRuntime();
  const active = useMemo(() => sections.filter((s) => isSectionEnabled(s.section ?? s.id)), [sections, isSectionEnabled]);
  const [opened, setOpened] = useState(false);
  const [step, setStep] = useState(0);
  const [gateKey, setGateKey] = useState(0);

  useSmoothScroll();

  useEffect(() => {
    if (opened) return;
    lockScroll();
    return () => unlockScroll();
  }, [opened]);

  useEffect(() => {
    if (step === 0) return;
    const id = setTimeout(() => {
      const el = document.getElementById(`zw-stage-${step}`);
      if (el) scrollToElement(el);
    }, 80);
    return () => clearTimeout(id);
  }, [step]);

  useEffect(() => {
    if (opened) writeProgress(storageKey, step);
  }, [opened, step, storageKey]);

  const open = useCallback(() => {
    setStep(Math.min(readProgress(storageKey), active.length - 1));
    setOpened(true);
  }, [storageKey, active.length]);

  const next = useCallback((i: number) => setStep((s) => Math.min(Math.max(s, i + 1), active.length - 1)), [active.length]);

  const restart = useCallback(() => {
    writeProgress(storageKey, 0);
    setStep(0);
    setGateKey((k) => k + 1);
    setOpened(false);
    requestAnimationFrame(() => scrollToTop());
  }, [storageKey]);

  return (
    <>
      {!opened && <div key={gateKey}>{renderGate({ onOpen: open })}</div>}
      <main inert={!opened} aria-hidden={!opened}>
        {opened &&
          active.slice(0, step + 1).map((section, i) => (
            <div key={`${gateKey}-${section.id}`} id={`zw-stage-${i}`} data-section={section.id}>
              {section.render({
                domId: `zw-stage-${i}`,
                index: i,
                isLast: i === active.length - 1,
                showNext: step === i && i < active.length - 1,
                onNext: () => next(i),
                restart,
              })}
            </div>
          ))}
      </main>
      {renderChrome?.({ total: Math.max(active.length - 1, 0), done: step, opened })}
      {children}
    </>
  );
}
