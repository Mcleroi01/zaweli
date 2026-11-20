import { z } from "zod";

/**
 * Aide à l'écriture (cahier des charges §7.9). Le texte proposé n'est
 * jamais inséré sans l'accord de l'expéditeur ; le quota est décompté par
 * le serveur, sur une licence active.
 */
export const AI_TONES = ["tender", "funny", "solemn", "professional"] as const;
export const AI_LENGTHS = ["short", "medium", "long"] as const;

export const aiSuggestSchema = z.strictObject({
  experienceId: z.uuid(),
  fieldId: z.string().regex(/^[a-z][a-zA-Z0-9]{1,40}$/),
  tone: z.enum(AI_TONES),
  length: z.enum(AI_LENGTHS).default("medium"),
  /** Précisions de l'expéditeur (souvenir, surnom…), facultatives. */
  hint: z.string().trim().max(240).optional(),
});
export type AiSuggestRequest = z.infer<typeof aiSuggestSchema>;
export type AiSuggestInput = z.input<typeof aiSuggestSchema>;

export type AiSuggestResponse = {
  text: string;
  /** Suggestions restantes sur la licence utilisée (null si aucune licence n'a de quota). */
  remaining: number | null;
};

export type AiQuotaResponse = { available: boolean; remaining: number };
