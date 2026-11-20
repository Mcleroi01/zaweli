"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, type Locale } from "@zaweli/shared-types";
import { checkRiddleAnswer, type PublicPayload, type PublicRiddle } from "../schema/payload.js";
import { MusicLayer } from "./music.js";

/**
 * Seule porte d'un template vers l'extérieur (architecture §5.5).
 * Un template ne fait jamais d'appel réseau lui-même.
 */
export type ExperienceMode = "live" | "preview" | "demo";

/**
 * Services fournis par la page qui affiche l'expérience (le template ne
 * fait jamais d'appel réseau lui-même). Tous facultatifs : en démonstration
 * ou en aperçu, ils sont simplement absents.
 */
export type ExperienceServices = {
  /** Données protégées d'un cadeau (ex. code d'un bon), livrées au déballage ; null s'il n'y en a pas. */
  revealGift?: (giftId: string) => Promise<Record<string, unknown> | null>;
};

export type ExperienceRuntime = {
  mode: ExperienceMode;
  payload: PublicPayload;
  /** Langue des textes fixes du template (français pour les anciens instantanés). */
  locale: Locale;
  /** Valeur publique d'un champ du manifeste. */
  field: <T>(id: string) => T | undefined;
  isSectionEnabled: (sectionId: string) => boolean;
  checkRiddle: (riddleIndex: number, riddle: PublicRiddle, choiceIndex: number) => Promise<boolean>;
  services: ExperienceServices;
};

const RuntimeContext = createContext<ExperienceRuntime | null>(null);

export function ExperienceRuntimeProvider({
  payload,
  mode,
  services,
  children,
}: {
  payload: PublicPayload;
  mode: ExperienceMode;
  services?: ExperienceServices;
  children: ReactNode;
}) {
  const value = useMemo<ExperienceRuntime>(
    () => ({
      mode,
      payload,
      locale: payload.locale ?? DEFAULT_LOCALE,
      field: <T,>(id: string) => payload.fields[id] as T | undefined,
      isSectionEnabled: (id) => !payload.disabledSections.includes(id),
      checkRiddle: (index, riddle, choice) => checkRiddleAnswer(payload, index, riddle, choice),
      services: services ?? {},
    }),
    [payload, mode, services],
  );
  return (
    <RuntimeContext.Provider value={value}>
      {children}
      {/* Musique de l'expéditeur : pas en démonstration (contenu d'exemple), oui en aperçu et en vrai. */}
      {payload.music && mode !== "demo" && <MusicLayer music={payload.music} locale={value.locale} />}
    </RuntimeContext.Provider>
  );
}

export function useRuntime(): ExperienceRuntime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error("useRuntime() doit être utilisé dans <ExperienceRuntimeProvider>");
  return runtime;
}

/** Raccourci : valeur d'un champ obligatoire (lève une erreur explicite si absente). */
export function useField<T>(id: string): T {
  const value = useRuntime().field<T>(id);
  if (value === undefined) throw new Error(`Champ absent de la charge publique : ${id}`);
  return value;
}

export function useOptionalField<T>(id: string): T | undefined {
  return useRuntime().field<T>(id);
}
