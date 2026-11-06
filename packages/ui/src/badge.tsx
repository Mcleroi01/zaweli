import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "gold";

const TONES: Record<Tone, string> = {
  neutral: "bg-ink/5 text-ink",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  gold: "bg-gold/15 text-[#6b4d12]",
};

/** Pastille d'état. Toujours accompagnée d'un texte : jamais la couleur seule (X8). */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}
