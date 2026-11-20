import { Inject, Injectable } from "@nestjs/common";
import { ENV, type Env } from "../config/env.js";

export type AiMessage = { role: "system" | "user"; content: string };
export type AiCompletion = { text: string; model: string; promptTokens: number | null; completionTokens: number | null };

/**
 * Fournisseur de texte (abstraction exigée par §7.9 : changer de modèle sans
 * toucher au produit). Les tests branchent un faux fournisseur.
 */
export abstract class AiProvider {
  abstract readonly available: boolean;
  abstract complete(messages: AiMessage[], maxTokens: number): Promise<AiCompletion>;
}

/** OpenRouter (API compatible « chat completions »). Le modèle est un réglage, jamais codé en dur. */
@Injectable()
export class OpenRouterProvider extends AiProvider {
  readonly available: boolean;

  constructor(@Inject(ENV) private readonly env: Env) {
    super();
    this.available = Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_MODEL);
  }

  async complete(messages: AiMessage[], maxTokens: number): Promise<AiCompletion> {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.env.OPENROUTER_API_KEY}`,
        "content-type": "application/json",
        "x-title": "Zaweli",
        "http-referer": this.env.PUBLIC_WEB_URL,
      },
      body: JSON.stringify({ model: this.env.OPENROUTER_MODEL, messages, max_tokens: maxTokens, temperature: 0.8 }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`openrouter ${res.status}`);
    const body = (await res.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("openrouter_empty");
    return {
      text,
      model: body.model ?? this.env.OPENROUTER_MODEL!,
      promptTokens: body.usage?.prompt_tokens ?? null,
      completionTokens: body.usage?.completion_tokens ?? null,
    };
  }
}
