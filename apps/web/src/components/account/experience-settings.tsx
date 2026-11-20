"use client";

import { audiusPageUrl, audiusStreamUrl, type ExperienceDetailResponse, type MusicChoice } from "@zaweli/shared-types";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "@/account/client";
import { useAccount } from "@/account/session";
import { Banner, Button, Card, Field, TextInput } from "./ui";

const errorText = (err: unknown, fallback: string) => (err instanceof ApiRequestError && err.message ? err.message : fallback);

/** « 2026-12-24T18:00 » (heure locale) ↔ ISO, pour <input type="datetime-local">. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const duration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Ouverture et ambiance d'une expérience (§7.6, §11.1) : code demandé au
 * destinataire, date d'ouverture du lien, musique Audius. Appliqué tout de
 * suite, même sur une expérience déjà publiée.
 */
export function ExperienceSettingsPanel({ detail, onChange }: { detail: ExperienceDetailResponse; onChange: (d: ExperienceDetailResponse) => void }) {
  const { t, api } = useAccount();
  const s = t.settingsPanel;
  const [code, setCode] = useState("");
  const [date, setDate] = useState(toLocalInput(detail.availableFrom));
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (body: Parameters<typeof api.settings>[1], ok: string) => {
    setBusy(true);
    setMessage(null);
    try {
      onChange(await api.settings(detail.id, body));
      setMessage({ tone: "success", text: ok });
      setCode("");
    } catch (err) {
      setMessage({ tone: "danger", text: errorText(err, t.common.unavailable) });
    }
    setBusy(false);
  };

  return (
    <Card className="space-y-8 p-5">
      <div>
        <h3 className="font-display text-[1.3rem]">{s.title}</h3>
        <p className="mt-1 text-[0.9rem] text-muted">{s.lead}</p>
      </div>

      <section className="space-y-3">
        <h4 className="kicker text-muted">{s.codeTitle}</h4>
        <p className="text-[0.9rem]">{detail.hasAccessCode ? s.codeOn : s.codeOff}</p>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void save({ accessCode: code.trim() }, s.codeSaved);
          }}
        >
          <Field label={detail.hasAccessCode ? s.codeNew : s.codeLabel} hint={s.codeHint}>
            {(f) => <TextInput {...f} value={code} onChange={(e) => setCode(e.target.value)} minLength={4} maxLength={20} autoComplete="off" />}
          </Field>
          <Button type="submit" variant="secondary" disabled={busy || code.trim().length < 4}>
            {s.codeSave}
          </Button>
          {detail.hasAccessCode && (
            <Button variant="quiet" disabled={busy} onClick={() => void save({ accessCode: null }, s.codeRemoved)}>
              {s.codeRemove}
            </Button>
          )}
        </form>
      </section>

      <section className="space-y-3 border-t border-line pt-6">
        <h4 className="kicker text-muted">{s.dateTitle}</h4>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void save({ availableFrom: date ? new Date(date).toISOString() : null }, date ? s.dateSaved : s.dateRemoved);
          }}
        >
          <Field label={s.dateLabel} hint={s.dateHint}>
            {(f) => <TextInput {...f} type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Button type="submit" variant="secondary" disabled={busy}>
            {s.dateSave}
          </Button>
          {detail.availableFrom && (
            <Button
              variant="quiet"
              disabled={busy}
              onClick={() => {
                setDate("");
                void save({ availableFrom: null }, s.dateRemoved);
              }}
            >
              {s.dateRemove}
            </Button>
          )}
        </form>
      </section>

      <section className="space-y-3 border-t border-line pt-6">
        <h4 className="kicker text-muted">{s.musicTitle}</h4>
        <MusicPicker current={detail.music} busy={busy} onPick={(music) => void save({ music }, music ? s.musicSaved : s.musicRemoved)} />
      </section>

      {message && <Banner tone={message.tone}>{message.text}</Banner>}
    </Card>
  );
}

/** Recherche Audius, écoute d'un extrait, choix. Seuls les titres librement écoutables sont proposés (API). */
function MusicPicker({ current, busy, onPick }: { current: MusicChoice | null; busy: boolean; onPick: (m: MusicChoice | null) => void }) {
  const { t, api } = useAccount();
  const s = t.settingsPanel;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MusicChoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [listening, setListening] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  const listen = (m: MusicChoice) => {
    if (listening === m.trackId) {
      audio.current?.pause();
      setListening(null);
      return;
    }
    audio.current?.pause();
    const el = new Audio(audiusStreamUrl(m.trackId));
    el.volume = 0.6;
    el.addEventListener("ended", () => setListening(null));
    void el.play().catch(() => setListening(null));
    audio.current = el;
    setListening(m.trackId);
  };

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setSearching(true);
    setError(null);
    try {
      setResults((await api.searchMusic(q.trim())).tracks);
    } catch (err) {
      setError(errorText(err, s.musicUnavailable));
    }
    setSearching(false);
  };

  return (
    <div className="space-y-3">
      {current ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
          <p className="min-w-0 text-[0.92rem]">
            <span className="font-medium">{current.title}</span> · {current.artist}{" "}
            <a href={audiusPageUrl(current.permalink)} target="_blank" rel="noreferrer" className="link-draw text-muted">
              Audius
            </a>
          </p>
          <Button variant="quiet" disabled={busy} onClick={() => onPick(null)}>
            {s.musicRemove}
          </Button>
        </div>
      ) : (
        <p className="text-[0.9rem] text-muted">{s.musicNone}</p>
      )}
      <form onSubmit={search} className="flex flex-wrap items-end gap-2">
        <Field label={s.musicSearch}>
          {(f) => <TextInput {...f} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.musicPlaceholder} maxLength={80} />}
        </Field>
        <Button type="submit" variant="secondary" disabled={searching || q.trim().length < 2}>
          {searching ? "…" : s.musicSearchButton}
        </Button>
      </form>
      {error && <Banner tone="danger">{error}</Banner>}
      {results && results.length === 0 && <p className="text-[0.9rem] text-muted">{s.musicEmpty}</p>}
      {results && results.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {results.map((m) => (
            <li key={m.trackId} className="flex items-center gap-3 p-3">
              {m.artworkUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- pochette servie par Audius
                <img src={m.artworkUrl} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-md object-cover" />
              ) : (
                <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-ink/10">
                  ♪
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.92rem] font-medium">{m.title}</p>
                <p className="truncate text-[0.82rem] text-muted">
                  {m.artist} · {duration(m.durationSeconds)}
                </p>
              </div>
              <Button variant="quiet" onClick={() => listen(m)} aria-pressed={listening === m.trackId}>
                {listening === m.trackId ? s.musicStop : s.musicListen}
              </Button>
              <Button variant="secondary" disabled={busy || current?.trackId === m.trackId} onClick={() => onPick(m)}>
                {current?.trackId === m.trackId ? s.musicChosen : s.musicChoose}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[0.78rem] text-muted">{s.musicCredit}</p>
    </div>
  );
}
