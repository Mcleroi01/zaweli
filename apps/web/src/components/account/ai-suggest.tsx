"use client";

import { AI_LENGTHS, AI_TONES } from "@zaweli/shared-types";
import { useState } from "react";
import { ApiRequestError } from "@/account/client";
import { useAccount } from "@/account/session";
import { useDraftExperienceId } from "./photo-field";
import { Banner, Button, Field, Select, TextInput } from "./ui";

/**
 * Aide à l'écriture (§7.9) : ton, longueur, précisions, puis une proposition
 * à relire. Rien n'est inséré sans « Utiliser ce texte ».
 */
export function AiSuggest({ fieldId, long, onAccept }: { fieldId: string; long: boolean; onAccept: (text: string) => void }) {
  const { t, api } = useAccount();
  const experienceId = useDraftExperienceId();
  const a = t.ai;
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<(typeof AI_TONES)[number]>("tender");
  const [length, setLength] = useState<(typeof AI_LENGTHS)[number]>("medium");
  const [hint, setHint] = useState("");
  const [proposal, setProposal] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!experienceId) return null;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-[0.88rem] text-primary underline-offset-4 hover:underline">
        ✦ {a.open}
      </button>
    );
  }

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.aiSuggest({ experienceId, fieldId, tone, length: long ? length : "short", ...(hint.trim() ? { hint: hint.trim() } : {}) });
      setProposal(res.text);
      setRemaining(res.remaining);
    } catch (err) {
      setError(err instanceof ApiRequestError && err.message ? err.message : t.common.unavailable);
    }
    setBusy(false);
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-line bg-paper p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={a.tone}>
          {(p) => (
            <Select {...p} value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>
              {AI_TONES.map((x) => (
                <option key={x} value={x}>
                  {a.tones[x]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {long && (
          <Field label={a.length}>
            {(p) => (
              <Select {...p} value={length} onChange={(e) => setLength(e.target.value as typeof length)}>
                {AI_LENGTHS.map((x) => (
                  <option key={x} value={x}>
                    {a.lengths[x]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </div>
      <Field label={a.hint} optionalLabel={t.common.optional} hint={a.hintHelp}>
        {(p) => <TextInput {...p} maxLength={240} value={hint} onChange={(e) => setHint(e.target.value)} />}
      </Field>
      {proposal && (
        <div className="rounded-lg border border-primary/30 bg-surface p-3">
          <p className="kicker text-muted">{a.proposal}</p>
          <p className="mt-2 text-[0.95rem] whitespace-pre-line">{proposal}</p>
        </div>
      )}
      {error && <Banner tone="danger">{error}</Banner>}
      <div className="flex flex-wrap items-center gap-2">
        {proposal && (
          <Button
            onClick={() => {
              onAccept(proposal);
              setProposal(null);
              setOpen(false);
            }}
          >
            {a.use}
          </Button>
        )}
        <Button variant="secondary" disabled={busy} onClick={() => void generate()}>
          {busy ? a.writing : proposal ? a.another : a.generate}
        </Button>
        <Button variant="quiet" onClick={() => setOpen(false)}>
          {t.common.cancel}
        </Button>
        {remaining !== null && <span className="text-[0.82rem] text-muted">{a.remaining(remaining)}</span>}
      </div>
      <p className="text-[0.78rem] text-muted">{a.truth}</p>
    </div>
  );
}
