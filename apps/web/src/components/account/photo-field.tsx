"use client";

import { MEDIA_MAX_BYTES, type MediaResponse } from "@zaweli/shared-types";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiRequestError } from "@/account/client";
import { useAccount } from "@/account/session";
import { Banner, Button, Field, TextInput } from "./ui";

export type PhotoValue = { mediaId: string; alt: string; caption?: string };

type MediaContextValue = {
  experienceId: string;
  urls: Record<string, MediaResponse["urls"]>;
  remember: (id: string, urls: MediaResponse["urls"]) => void;
};

const MediaContext = createContext<MediaContextValue | null>(null);

/** Identifiant du brouillon en cours (pour les outils de l'assistant : photos, aide à l'écriture). */
export function useDraftExperienceId(): string | null {
  return useContext(MediaContext)?.experienceId ?? null;
}

/** Plus grand côté envoyé : au-delà, l'image est réduite dans le navigateur (moins de données mobiles). */
const MAX_SIDE = 2560;

/**
 * Vignettes des photos d'un brouillon : une seule requête pour toutes les
 * photos déjà présentes, puis chaque envoi ajoute la sienne.
 */
export function MediaProvider({ experienceId, mediaIds, children }: { experienceId: string; mediaIds: string[]; children: ReactNode }) {
  const { api } = useAccount();
  const [urls, setUrls] = useState<Record<string, MediaResponse["urls"]>>({});
  const key = [...new Set(mediaIds)].sort().join(",");
  useEffect(() => {
    if (!key) return;
    let alive = true;
    void api
      .mediaUrls(key.split(","))
      .then((res) => {
        if (alive) setUrls((u) => ({ ...u, ...Object.fromEntries(Object.entries(res).map(([id, m]) => [id, m.urls])) }));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [api, key]);
  const remember = useCallback((id: string, u: MediaResponse["urls"]) => setUrls((prev) => ({ ...prev, [id]: u })), []);
  const value = useMemo(() => ({ experienceId, urls, remember }), [experienceId, urls, remember]);
  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

/** Réduit l'image et la redresse (orientation du téléphone), en JPEG ; le serveur refait le traitement complet. */
async function prepare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.type === "image/jpeg" && file.size < 8 * 1024 * 1024) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const g = canvas.getContext("2d");
  if (!g) return file;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.9));
}

/**
 * Une photo du brouillon : choix du fichier, envoi, vignette, et texte
 * alternatif (obligatoire : il est lu aux personnes qui ne voient pas l'image).
 */
export function PhotoInput({
  label,
  value,
  onChange,
  ratio,
  defaultAlt,
  captionMax,
  required,
}: {
  label: string;
  value: PhotoValue | undefined;
  onChange: (v: PhotoValue | undefined) => void;
  ratio?: string;
  defaultAlt: string;
  captionMax?: number;
  required?: boolean;
}) {
  const { t, api } = useAccount();
  const media = useContext(MediaContext);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"preparing" | "sending" | "processing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const thumb = value ? media?.urls[value.mediaId]?.md : null;
  const p = t.photos;
  const aspect = ratio ? ratio.replace(":", " / ") : "4 / 3";

  const pick = async (file: File | undefined) => {
    if (!file || !media) return;
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setError(p.wrongType);
    try {
      setBusy("preparing");
      const blob = await prepare(file);
      if (blob.size > MEDIA_MAX_BYTES) throw new Error(p.tooLarge);
      setBusy("sending");
      const mime = (blob.type || file.type) as "image/jpeg" | "image/png" | "image/webp";
      const { mediaId, uploadUrl } = await api.createMediaUpload({ experienceId: media.experienceId, mime, size: blob.size });
      const put = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": mime, "x-upsert": "false" }, body: blob });
      if (!put.ok) throw new Error(p.uploadFailed);
      setBusy("processing");
      const done = await api.completeMedia(mediaId);
      media.remember(mediaId, done.urls);
      onChange({ mediaId, alt: value?.alt || defaultAlt, ...(value?.caption ? { caption: value.caption } : {}) });
    } catch (err) {
      setError(err instanceof ApiRequestError && err.message ? err.message : err instanceof Error && err.message ? err.message : p.uploadFailed);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[0.92rem]">
        {label}
        {required && <span className="ml-1.5 text-[0.82rem] text-muted">({t.wizard.required})</span>}
      </p>
      <div className="flex flex-wrap items-start gap-4">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={Boolean(busy)}
          className="relative w-36 shrink-0 overflow-hidden rounded-xl border border-dashed border-line bg-paper focus-visible:outline-2 focus-visible:outline-primary"
          style={{ aspectRatio: aspect }}
          aria-label={value ? p.replace : p.choose}
        >
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- adresse signée temporaire du stockage privé
            <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center px-2 text-center text-[0.82rem] text-muted">
              {busy ? p.busy[busy] : value ? p.processing : p.add}
            </span>
          )}
          {busy && thumb && <span className="absolute inset-0 grid place-items-center bg-ink/50 text-[0.8rem] text-paper">{p.busy[busy]}</span>}
        </button>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => input.current?.click()} disabled={Boolean(busy)}>
              {value ? p.replace : p.choose}
            </Button>
            {value && !busy && (
              <Button variant="quiet" onClick={() => onChange(undefined)}>
                {p.remove}
              </Button>
            )}
          </div>
          {value && (
            <Field label={p.alt} hint={p.altHint}>
              {(f) => <TextInput {...f} maxLength={140} value={value.alt} onChange={(e) => onChange({ ...value, alt: e.target.value })} />}
            </Field>
          )}
          {value && captionMax ? (
            <Field label={p.caption} optionalLabel={t.common.optional}>
              {(f) => <TextInput {...f} maxLength={captionMax} value={value.caption ?? ""} onChange={(e) => onChange({ ...value, caption: e.target.value || undefined })} />}
            </Field>
          ) : null}
        </div>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void pick(e.target.files?.[0])} />
      {error && <Banner tone="danger">{error}</Banner>}
    </div>
  );
}

/** Liste de photos (min…max), chacune avec sa description et sa légende. */
export function PhotoListInput({
  label,
  value,
  onChange,
  min,
  max,
  captionMax,
  defaultAlt,
}: {
  label: string;
  value: PhotoValue[];
  onChange: (v: PhotoValue[]) => void;
  min: number;
  max: number;
  captionMax: number;
  defaultAlt: string;
}) {
  const { t } = useAccount();
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-4">
      <p className="text-[0.92rem]">
        {label} <span className="text-[0.8rem] text-muted">· {min === max ? t.wizard.exactly(max) : t.wizard.between(min, max)}</span>
      </p>
      {value.map((photo, i) => (
        <PhotoInput
          key={photo.mediaId}
          label={`${t.photos.photo} ${i + 1}`}
          value={photo}
          captionMax={captionMax}
          defaultAlt={defaultAlt}
          onChange={(v) => onChange(v ? value.map((x, j) => (j === i ? v : x)) : value.filter((_, j) => j !== i))}
        />
      ))}
      {value.length < max &&
        (adding ? (
          <PhotoInput
            label={`${t.photos.photo} ${value.length + 1}`}
            value={undefined}
            captionMax={captionMax}
            defaultAlt={defaultAlt}
            onChange={(v) => {
              if (v) onChange([...value, v]);
              setAdding(false);
            }}
          />
        ) : (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            + {t.photos.add}
          </Button>
        ))}
    </div>
  );
}
