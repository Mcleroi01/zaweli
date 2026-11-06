"use client";

import { useMemo } from "react";
import {
  ConfettiLayer,
  type ExperienceMode,
  ExperienceRunner,
  ExperienceRuntimeProvider,
  type RunnerSection,
} from "@zaweli/template-engine/react";
import type { PublicPayload, PublicRiddle } from "@zaweli/template-engine/schema";
import { Celebration } from "./Celebration.js";
import { Finale } from "./Finale.js";
import { Gifts } from "./Gifts.js";
import { JewelBox } from "./JewelBox.js";
import { Riddle } from "./Riddle.js";
import { Seal } from "./Seal.js";
import { FESTIVE, Pearls, SoundToggle } from "./ui.js";

type Props = {
  payload: PublicPayload;
  mode: ExperienceMode;
  /** Clé de mémorisation locale de la progression (ex. le slug de l'expérience). */
  storageKey?: string;
};

/** Coffret 1.0.0 : assemblage des scènes sur le moteur d'étapes générique. */
export function CoffretExperience({ payload, mode, storageKey }: Props) {
  const riddles = (payload.fields.riddles as PublicRiddle[] | undefined) ?? [];

  const sections = useMemo<RunnerSection[]>(
    () => [
      { id: "jewel", render: (p) => <JewelBox {...p} /> },
      ...riddles.map<RunnerSection>((riddle, i) => ({
        id: `riddles:${i}`,
        section: "riddles",
        render: (p) => <Riddle {...p} riddle={riddle} number={i} />,
      })),
      { id: "gifts", render: (p) => <Gifts {...p} /> },
      { id: "celebration", render: (p) => <Celebration {...p} /> },
      { id: "finale", render: (p) => <Finale {...p} /> },
    ],
    [riddles],
  );

  return (
    <ExperienceRuntimeProvider payload={payload} mode={mode}>
      <div data-template="coffret" className="velvet min-h-[100svh]">
        <div className="grain" aria-hidden="true" />
        <ExperienceRunner
          sections={sections}
          storageKey={storageKey}
          renderGate={({ onOpen }) => <Seal onOpen={onOpen} />}
          renderChrome={({ total, done, opened }) => (
            <>
              <Pearls total={total} done={done} visible={opened} />
              <SoundToggle visible={opened} />
            </>
          )}
        >
          <ConfettiLayer colors={FESTIVE} />
        </ExperienceRunner>
      </div>
    </ExperienceRuntimeProvider>
  );
}
