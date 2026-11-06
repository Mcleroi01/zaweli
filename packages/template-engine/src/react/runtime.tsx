"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { checkRiddleAnswer, type PublicPayload, type PublicRiddle } from "../schema/payload.js";

/**
 * Seule porte d'un template vers l'extérieur (architecture §5.5).
 * Un template ne fait jamais d'appel réseau lui-même.
 */
export type ExperienceMode = "live" | "preview" | "demo";

export type ExperienceRuntime = {
  mode: ExperienceMode;
  payload: PublicPayload;
  /** Valeur publique d'un champ du manifeste. */
  field: <T>(id: string) => T | undefined;
  isSectionEnabled: (sectionId: string) => boolean;
  checkRiddle: (riddleIndex: number, riddle: PublicRiddle, choiceIndex: number) => Promise<boolean>;
};

const RuntimeContext = createContext<ExperienceRuntime | null>(null);

export function ExperienceRuntimeProvider({
  payload,
  mode,
  children,
}: {
  payload: PublicPayload;
  mode: ExperienceMode;
  children: ReactNode;
}) {
  const value = useMemo<ExperienceRuntime>(
    () => ({
      mode,
      payload,
      field: <T,>(id: string) => payload.fields[id] as T | undefined,
      isSectionEnabled: (id) => !payload.disabledSections.includes(id),
      checkRiddle: (index, riddle, choice) => checkRiddleAnswer(payload, index, riddle, choice),
    }),
    [payload, mode],
  );
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
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
