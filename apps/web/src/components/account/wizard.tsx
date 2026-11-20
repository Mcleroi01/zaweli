"use client";

import type {
  EligibilityResponse,
  ExperienceDetailResponse,
  GiftResponse,
  PublishResponse,
  TemplateDetailResponse,
} from "@zaweli/shared-types";
import { MOBILE_MONEY_COUNTRIES } from "@zaweli/shared-types";
import type { FieldDef, GiftListField, RiddleListField } from "@zaweli/template-engine/schema";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiRequestError } from "@/account/client";
import { FullPageStatus, RequireSession, useAccount } from "@/account/session";
import { templateLabels } from "@/i18n/template-fields";
import { CopyButton, ErrorBanner, publicUrl } from "./dashboard";
import { AiSuggest } from "./ai-suggest";
import { ExperienceSettingsPanel } from "./experience-settings";
import { GiftFundingPanel } from "./gift-funding";
import { MediaProvider, PhotoInput, PhotoListInput, type PhotoValue } from "./photo-field";
import { QrCode } from "./qr-code";
import { Banner, Button, ButtonLink, Card, Field, Select, TextArea, TextInput } from "./ui";

type Fields = Record<string, unknown>;
type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiRequestError && err.message ? err.message : fallback;

/**
 * Contenu envoyé à l'API : les lignes encore vides restent à l'écran mais ne
 * partent pas (le schéma du brouillon refuse un mot ou un paragraphe vide).
 */
function cleanFields(defs: Record<string, FieldDef>, fields: Fields): Fields {
  const out: Fields = {};
  for (const [id, value] of Object.entries(fields)) {
    const def = defs[id];
    if (!def || value === undefined || value === null) continue;
    switch (def.kind) {
      case "shortText":
      case "longText":
        if (typeof value === "string" && value.trim() !== "") out[id] = value;
        break;
      case "integer":
        if (typeof value === "number" && Number.isFinite(value)) out[id] = value;
        break;
      case "wordList":
      case "textList":
        out[id] = (value as string[]).filter((s) => s.trim() !== "");
        break;
      case "entryList":
        out[id] = (value as Array<{ title: string; text: string }>).filter((e) => e.title.trim() !== "");
        break;
      case "photo":
        if ((value as PhotoValue).mediaId) out[id] = value;
        break;
      case "photoList":
        out[id] = (value as PhotoValue[]).filter((x) => x.mediaId);
        break;
      default:
        out[id] = value;
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// Champs générés depuis le manifeste (docs/05 W5)
// ---------------------------------------------------------------------

function ListEditor({
  items,
  min,
  max,
  render,
  onChange,
  empty,
}: {
  items: unknown[];
  min: number;
  max: number;
  render: (item: unknown, i: number, set: (v: unknown) => void) => ReactNode;
  onChange: (items: unknown[]) => void;
  empty: () => unknown;
}) {
  const { t } = useAccount();
  return (
    <div className="mt-2 space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {render(item, i, (v) => onChange(items.map((x, j) => (j === i ? v : x))))}
          </div>
          {items.length > min && (
            <Button
              variant="quiet"
              aria-label={`${t.wizard.removeItem} ${i + 1}`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              ✕
            </Button>
          )}
        </div>
      ))}
      {items.length < max && (
        <Button variant="secondary" onClick={() => onChange([...items, empty()])}>
          + {t.wizard.addItem}
        </Button>
      )}
    </div>
  );
}

function RiddleEditor({
  def,
  value,
  onChange,
}: {
  def: RiddleListField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { t } = useAccount();
  type Riddle = { question: string; choices: string[]; answer: number; hint?: string; photo?: PhotoValue; reveal: string };
  const riddles = (value as Riddle[] | undefined) ?? [];
  const blank = (): Riddle => ({
    question: "",
    choices: Array.from({ length: def.choices }, () => ""),
    answer: 0,
    reveal: "",
  });
  const set = (i: number, patch: Partial<Riddle>) =>
    onChange(riddles.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-4">
      {riddles.map((r, i) => (
        <Card key={i} className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-[1.2rem]">{t.wizard.riddle(i + 1)}</p>
            {riddles.length > def.min && (
              <Button variant="danger" onClick={() => onChange(riddles.filter((_, j) => j !== i))}>
                {t.wizard.removeItem}
              </Button>
            )}
          </div>
          <Field label={t.wizard.question} counter={t.wizard.counter(r.question.length, def.questionMax)}>
            {(p) => (
              <TextArea
                {...p}
                rows={2}
                maxLength={def.questionMax}
                value={r.question}
                onChange={(e) => set(i, { question: e.target.value })}
              />
            )}
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-[0.92rem]">{t.wizard.goodAnswer}</legend>
            {r.choices.map((choice, c) => (
              <div key={c} className="flex items-center gap-3">
                <input
                  type="radio"
                  name={`riddle-${i}`}
                  aria-label={`${t.wizard.goodAnswer} : ${t.wizard.choice(c + 1)}`}
                  checked={r.answer === c}
                  onChange={() => set(i, { answer: c })}
                  className="h-5 w-5 shrink-0 accent-[var(--color-primary)]"
                />
                <TextInput
                  aria-label={t.wizard.choice(c + 1)}
                  placeholder={t.wizard.choice(c + 1)}
                  maxLength={def.choiceMax}
                  value={choice}
                  onChange={(e) =>
                    set(i, { choices: r.choices.map((x, k) => (k === c ? e.target.value : x)) })
                  }
                  className="mt-0"
                />
              </div>
            ))}
          </fieldset>
          <Field label={t.wizard.hint} optionalLabel={t.common.optional}>
            {(p) => (
              <TextInput
                {...p}
                maxLength={def.hintMax}
                value={r.hint ?? ""}
                onChange={(e) => set(i, { hint: e.target.value || undefined })}
              />
            )}
          </Field>
          <Field label={t.wizard.reveal} counter={t.wizard.counter(r.reveal.length, def.revealMax)}>
            {(p) => (
              <TextInput
                {...p}
                maxLength={def.revealMax}
                value={r.reveal}
                onChange={(e) => set(i, { reveal: e.target.value })}
              />
            )}
          </Field>
          <PhotoInput
            label={t.photos.riddlePhoto}
            value={r.photo}
            ratio={def.photo.ratio}
            required={def.photo.required}
            defaultAlt={t.photos.riddleAlt(i + 1)}
            onChange={(photo) => set(i, { photo })}
          />
        </Card>
      ))}
      {riddles.length < def.max && (
        <Button variant="secondary" onClick={() => onChange([...riddles, blank()])}>
          + {t.wizard.riddle(riddles.length + 1)}
        </Button>
      )}
    </div>
  );
}

function FieldInput({
  fieldId,
  def,
  value,
  onChange,
  labels: rawLabels,
}: {
  fieldId: string;
  def: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  labels: { label: string; help?: string };
}) {
  const { t } = useAccount();
  const optional = "required" in def && !def.required ? t.common.optional : undefined;
  // Certains manifestes écrivent déjà « (facultatif) » dans le libellé : on ne le répète pas.
  const labels = optional ? { ...rawLabels, label: rawLabels.label.replace(/\s*\((facultatif|optional)\)\s*$/i, "") } : rawLabels;

  switch (def.kind) {
    case "shortText":
    case "longText": {
      const text = (value as string | undefined) ?? "";
      const Input = def.kind === "longText" ? TextArea : TextInput;
      return (
        <Field
          label={labels.label}
          hint={labels.help}
          optionalLabel={optional}
          counter={t.wizard.counter(text.length, def.max)}
        >
          {(p) => (
            <>
              <Input {...p} maxLength={def.max} value={text} onChange={(e) => onChange(e.target.value)} />
              {def.aiAssist && <AiSuggest fieldId={fieldId} long={def.kind === "longText"} onAccept={(s) => onChange(s)} />}
            </>
          )}
        </Field>
      );
    }
    case "integer":
      return (
        <Field label={labels.label} hint={labels.help} optionalLabel={optional}>
          {(p) => (
            <TextInput
              {...p}
              type="number"
              inputMode="numeric"
              min={def.min}
              max={def.max}
              value={typeof value === "number" ? value : ""}
              onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
              className="max-w-40"
            />
          )}
        </Field>
      );
    case "select":
      return (
        <Field label={labels.label} hint={labels.help} optionalLabel={optional}>
          {(p) => (
            <Select
              {...p}
              value={(value as string | undefined) ?? ""}
              onChange={(e) => onChange(e.target.value || undefined)}
            >
              <option value="">—</option>
              {def.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      );
    case "toggle":
      return (
        <label className="flex min-h-11 items-center gap-3 text-[0.95rem]">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--color-primary)]"
            checked={(value as boolean | undefined) ?? def.default}
            onChange={(e) => onChange(e.target.checked)}
          />
          {labels.label}
        </label>
      );
    case "photo":
      return (
        <div>
          <PhotoInput
            label={labels.label}
            value={value as PhotoValue | undefined}
            ratio={def.ratio}
            required={def.required}
            defaultAlt={labels.label}
            onChange={(v) => onChange(v)}
          />
          {labels.help && <p className="mt-1.5 text-[0.84rem] text-muted">{labels.help}</p>}
        </div>
      );
    case "photoList":
      return (
        <PhotoListInput
          label={labels.label}
          value={(value as PhotoValue[] | undefined) ?? []}
          min={def.min}
          max={def.max}
          captionMax={def.captionMax}
          defaultAlt={labels.label}
          onChange={(v) => onChange(v)}
        />
      );
    case "wordList":
    case "textList": {
      const items = (value as string[] | undefined) ?? [];
      const bounds = def.min === def.max ? t.wizard.exactly(def.max) : t.wizard.between(def.min, def.max);
      const Input = def.kind === "textList" && def.maxEach > 120 ? TextArea : TextInput;
      return (
        <div>
          <div className="flex justify-between text-[0.92rem]">
            <span>{labels.label}</span>
            <span className="text-[0.8rem] text-muted">
              {t.wizard.counter(items.filter((x) => x.trim()).length, def.max)} · {bounds}
            </span>
          </div>
          {labels.help && <p className="mt-1 text-[0.84rem] text-muted">{labels.help}</p>}
          <ListEditor
            items={items}
            min={0}
            max={def.max}
            empty={() => ""}
            onChange={(v) => onChange(v)}
            render={(item, i, set) => (
              <Input
                aria-label={`${labels.label} ${i + 1}`}
                maxLength={def.maxEach}
                value={item as string}
                onChange={(e) => set(e.target.value)}
                className="mt-0"
              />
            )}
          />
        </div>
      );
    }
    case "entryList": {
      const items = (value as Array<{ title: string; text: string }> | undefined) ?? [];
      return (
        <div>
          <p className="text-[0.92rem]">{labels.label}</p>
          <ListEditor
            items={items}
            min={0}
            max={def.max}
            empty={() => ({ title: "", text: "" })}
            onChange={(v) => onChange(v)}
            render={(item, i, set) => {
              const entry = item as { title: string; text: string };
              return (
                <Card className="space-y-3 p-4">
                  <TextInput
                    aria-label={`${t.wizard.entryTitle} ${i + 1}`}
                    placeholder={t.wizard.entryTitle}
                    maxLength={def.titleMax}
                    value={entry.title}
                    onChange={(e) => set({ ...entry, title: e.target.value })}
                    className="mt-0"
                  />
                  <TextArea
                    aria-label={`${t.wizard.entryText} ${i + 1}`}
                    placeholder={t.wizard.entryText}
                    rows={2}
                    maxLength={def.textMax}
                    value={entry.text}
                    onChange={(e) => set({ ...entry, text: e.target.value })}
                    className="mt-0"
                  />
                </Card>
              );
            }}
          />
        </div>
      );
    }
    case "riddleList":
      return (
        <div>
          <p className="mb-3 text-[0.92rem]">
            {labels.label} ·{" "}
            {def.min === def.max ? t.wizard.exactly(def.max) : t.wizard.between(def.min, def.max)}
          </p>
          <RiddleEditor def={def} value={value} onChange={onChange} />
        </div>
      );
    case "giftList":
      return null; // Rendu par <GiftStep> (cadeaux gérés par l'API, un par un).
    default:
      return null;
  }
}

// ---------------------------------------------------------------------
// Cadeaux (W6)
// ---------------------------------------------------------------------

type GiftInput = {
  key: string;
  kind: "text" | "textarea" | "number" | "date" | "time" | "url" | "select";
  max?: number;
  required?: boolean;
  options?: string[];
  protected?: true;
};

const CURRENCIES = ["CDF", "USD", "EUR", "XAF", "XOF", "GBP", "CAD", "ZAR", "NGN", "KES"];
/** Devises qu'un transfert via Zaweli peut encaisser et reverser (mobile money, docs/12). */
const TRANSFER_CURRENCIES = [...new Set(MOBILE_MONEY_COUNTRIES.flatMap((c) => c.currencies.map((x) => x.code)))];

const GIFT_FORMS: Record<string, GiftInput[]> = {
  MONEY: [
    { key: "amount", kind: "number", required: true },
    { key: "currency", kind: "select", required: true, options: CURRENCIES },
    {
      key: "receptionMode",
      kind: "select",
      required: true,
      options: ["in_person", "sender_mobile_money", "other"],
    },
    { key: "message", kind: "textarea", max: 240 },
  ],
  PHYSICAL: [
    { key: "name", kind: "text", max: 80, required: true },
    { key: "description", kind: "textarea", max: 240 },
    { key: "handover", kind: "text", max: 160 },
    { key: "message", kind: "textarea", max: 240 },
  ],
  INVITATION: [
    { key: "title", kind: "text", max: 80, required: true },
    { key: "place", kind: "text", max: 120, required: true },
    { key: "date", kind: "date", required: true },
    { key: "time", kind: "time" },
    { key: "address", kind: "text", max: 200 },
    { key: "mapUrl", kind: "url" },
    { key: "practicalInfo", kind: "textarea", max: 240 },
    { key: "message", kind: "textarea", max: 240 },
  ],
  VOUCHER: [
    { key: "title", kind: "text", max: 80, required: true },
    { key: "issuer", kind: "text", max: 80 },
    { key: "value", kind: "text", max: 40 },
    { key: "validUntil", kind: "date" },
    { key: "conditions", kind: "textarea", max: 240 },
    { key: "message", kind: "textarea", max: 240 },
    { key: "code", kind: "text", max: 60, protected: true },
  ],
  EXPERIENCE: [
    { key: "title", kind: "text", max: 80, required: true },
    { key: "description", kind: "textarea", max: 240 },
    { key: "when", kind: "text", max: 60 },
    { key: "place", kind: "text", max: 120 },
    { key: "message", kind: "textarea", max: 240 },
  ],
};

/** Clé du formulaire → clé des données attendues par l'API (« when » s'appelle « date » pour EXPERIENCE). */
const dataKey = (type: string, key: string) => (type === "EXPERIENCE" && key === "when" ? "date" : key);

function GiftForm({
  type,
  transfersEnabled,
  onAdd,
  onCancel,
}: {
  type: string;
  transfersEnabled: boolean;
  onAdd: (data: Record<string, unknown>, protectedData?: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useAccount();
  const fieldsT = t.gifts.fields as unknown as Record<string, string> & { reception: Record<string, string> };
  const [values, setValues] = useState<Record<string, string>>(() =>
    type === "MONEY" ? { currency: "USD", receptionMode: "in_person" } : ({} as Record<string, string>),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const transfer = type === "MONEY" && values.receptionMode === "zaweli_transfer";
  // Le transfert via Zaweli n'est proposé que s'il est ouvert ; il limite les devises à celles du mobile money.
  const inputs = (GIFT_FORMS[type] ?? []).map((i) =>
    i.key === "receptionMode" && transfersEnabled
      ? { ...i, options: [...i.options!, "zaweli_transfer"] }
      : i.key === "currency" && transfer
        ? { ...i, options: TRANSFER_CURRENCIES }
        : i,
  );
  const missing = inputs.some((i) => i.required && !values[i.key]?.trim());

  const submit = async () => {
    setBusy(true);
    setError(null);
    const data: Record<string, unknown> = {};
    const secret: Record<string, unknown> = {};
    for (const input of inputs) {
      const raw = values[input.key]?.trim();
      if (!raw) continue;
      const v = input.kind === "number" ? Number(raw.replace(",", ".")) : raw;
      if (input.protected) secret[input.key] = v;
      else data[dataKey(type, input.key)] = v;
    }
    try {
      await onAdd(data, Object.keys(secret).length ? secret : undefined);
    } catch (err) {
      setError(errorText(err, t.common.unavailable));
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4 p-5">
      <p className="font-display text-[1.3rem]">{t.gifts.types[type as keyof typeof t.gifts.types].name}</p>
      <Banner tone="info">{transfer ? t.funding.truth : t.gifts.truth[type as keyof typeof t.gifts.truth]}</Banner>
      {inputs.map((input) => {
        const label = fieldsT[input.key] ?? input.key;
        const value = values[input.key] ?? "";
        const set = (v: string) =>
          setValues((s) => {
            const next = { ...s, [input.key]: v };
            // Passer au transfert via Zaweli : la devise doit être payable par mobile money.
            if (input.key === "receptionMode" && v === "zaweli_transfer" && !TRANSFER_CURRENCIES.includes(next.currency ?? "")) next.currency = "USD";
            return next;
          });
        return (
          <Field
            key={input.key}
            label={label}
            optionalLabel={input.required ? undefined : t.common.optional}
            counter={input.max ? t.wizard.counter(value.length, input.max) : undefined}
          >
            {(p) =>
              input.kind === "textarea" ? (
                <TextArea
                  {...p}
                  rows={2}
                  maxLength={input.max}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                />
              ) : input.kind === "select" ? (
                <Select {...p} value={value} onChange={(e) => set(e.target.value)}>
                  {input.options!.map((o) => (
                    <option key={o} value={o}>
                      {input.key === "receptionMode" ? fieldsT.reception[o] : o}
                    </option>
                  ))}
                </Select>
              ) : (
                <TextInput
                  {...p}
                  type={input.kind === "number" ? "text" : input.kind}
                  inputMode={input.kind === "number" ? "decimal" : undefined}
                  maxLength={input.max}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                />
              )
            }
          </Field>
        );
      })}
      {error && <Banner tone="danger">{error}</Banner>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={busy || missing}>
          {busy ? t.common.saving : t.gifts.addGift}
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </Card>
  );
}

function giftSummary(g: GiftResponse): string {
  const d = g.data as Record<string, unknown>;
  if (g.type === "MONEY") return `${d.amount as number} ${d.currency as string}`;
  return String(d.name ?? d.title ?? "");
}

function GiftStep({
  def,
  gifts,
  experienceId,
  onChanged,
  onAdd,
  onRemove,
}: {
  def: GiftListField;
  gifts: GiftResponse[];
  experienceId: string;
  onChanged: () => void;
  onAdd: (
    type: string,
    data: Record<string, unknown>,
    protectedData?: Record<string, unknown>,
  ) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const { t, api } = useAccount();
  const [type, setType] = useState<string | null>(null);
  const [transfersEnabled, setTransfersEnabled] = useState(false);
  const full = gifts.length >= def.max;
  useEffect(() => {
    let alive = true;
    void api
      .paymentOptions()
      .then((o) => alive && setTransfersEnabled(o.moneyTransfers.enabled))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [api]);
  return (
    <div className="space-y-5">
      <p className="text-[0.95rem] text-muted">{t.gifts.lead(def.min, def.max)}</p>
      {gifts.length === 0 && <p className="text-[0.92rem] text-muted">{t.gifts.empty}</p>}
      <ul className="space-y-3">
        {gifts.map((g, i) => (
          <li key={g.id}>
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="kicker text-muted">
                  {i + 1} · {t.gifts.types[g.type as keyof typeof t.gifts.types]?.name ?? g.type}
                </p>
                <p className="mt-1 font-display text-[1.15rem]">{giftSummary(g)}</p>
                {g.type === "MONEY" && t.funding.status[g.status] && <p className="mt-1 text-[0.85rem] text-muted">{t.funding.status[g.status]}</p>}
              </div>
              {g.type === "MONEY" && !["ANNOUNCED", "AWAITING_FUNDING", "CANCELLED"].includes(g.status) ? (
                <p className="text-[0.82rem] text-muted">{t.funding.locked}</p>
              ) : (
                <Button variant="danger" onClick={() => onRemove(g.id)}>
                  {t.gifts.remove}
                </Button>
              )}
            </Card>
            {g.type === "MONEY" && g.status === "AWAITING_FUNDING" && (
              <div className="mt-2">
                <GiftFundingPanel experienceId={experienceId} giftId={g.id} onFunded={onChanged} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {!full && !type && (
        <div>
          <p className="mb-3 text-[0.95rem]">{t.gifts.addTitle}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {def.types.map((gt) => (
              <button
                key={gt}
                type="button"
                onClick={() => setType(gt)}
                className="min-h-24 rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="block font-display text-[1.15rem]">
                  {t.gifts.types[gt as keyof typeof t.gifts.types].name}
                </span>
                <span className="mt-1 block text-[0.84rem] text-muted">
                  {t.gifts.types[gt as keyof typeof t.gifts.types].line}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {type && (
        <GiftForm
          type={type}
          transfersEnabled={transfersEnabled}
          onCancel={() => setType(null)}
          onAdd={async (data, secret) => {
            await onAdd(type, data, secret);
            setType(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Vérification et publication (W7, W8)
// ---------------------------------------------------------------------

function Published({ result }: { result: PublishResponse }) {
  const { t, path } = useAccount();
  const url = publicUrl(result.slug);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <h1 className="display text-[clamp(2.6rem,8vw,4rem)]">{t.publish.doneTitle}</h1>
      <p className="mt-4 text-[1.02rem] text-muted">{t.publish.doneLead}</p>
      <Card className="mt-8 p-5">
        <p className="font-display text-[1.25rem] break-all">{url}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <CopyButton text={url} label={t.common.copy} />
          {canShare && (
            <Button onClick={() => void navigator.share({ url }).catch(() => undefined)}>
              {t.publish.share}
            </Button>
          )}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-6 text-[0.95rem] hover:border-ink"
          >
            {t.publish.whatsapp}
          </a>
        </div>
        <div className="mt-6 border-t border-line pt-6">
          <QrCode url={url} slug={result.slug} />
        </div>
      </Card>
      <ul className="mt-8 space-y-1 text-[0.92rem] text-muted">
        {t.publish.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a href={url} target="_blank" rel="noreferrer" className="link-draw text-[0.95rem]">
          {t.publish.viewExperience}
        </a>
        <Link href={path("/espace")} className="link-draw text-[0.95rem] text-muted">
          {t.publish.backToDashboard}
        </Link>
      </div>
    </div>
  );
}

function Review({
  detail,
  template,
  onGoTo,
  onPublished,
  flush,
}: {
  detail: ExperienceDetailResponse;
  template: TemplateDetailResponse;
  onGoTo: (step: number) => void;
  onPublished: (r: PublishResponse) => void;
  flush: () => Promise<ExperienceDetailResponse | null>;
}) {
  const { t, api, locale, path } = useAccount();
  const labels = templateLabels(locale, template.slug);
  const [fresh, setFresh] = useState<ExperienceDetailResponse>(detail);
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [license, setLicense] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; plans: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const republish = detail.status !== "draft";

  useEffect(() => {
    let alive = true;
    void (async () => {
      const saved = (await flush()) ?? (await api.experience(detail.id).catch(() => detail));
      if (!alive) return;
      setFresh(saved);
      if (!republish) {
        const e = await api.eligibility(detail.id).catch(() => null);
        if (!alive) return;
        setEligibility(e);
        setLicense(e?.defaultLicenseId ?? null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, detail, flush, republish]);

  const stepOf = (issuePath: string) => {
    const field = issuePath.split(".")[1];
    return template.steps.findIndex((s) => s.fields.includes(field ?? ""));
  };

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      onPublished(await api.publish(detail.id, license ? { licenseId: license } : {}));
    } catch (err) {
      const code = err instanceof ApiRequestError ? err.code : "";
      setError({
        text: errorText(err, t.common.unavailable),
        plans: code === "NO_ELIGIBLE_LICENSE" || code.startsWith("LICENSE_"),
      });
      setBusy(false);
    }
  };

  const ready = fresh.publishIssues.length === 0;
  return (
    <div className="space-y-8">
      <h2 className="display text-[clamp(2rem,5vw,2.6rem)]">{t.publish.title}</h2>
      <section>
        <h3 className="kicker text-muted">{t.publish.checklist}</h3>
        {ready ? (
          <div className="mt-3">
            <Banner tone="success">{t.publish.ready}</Banner>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {[...fresh.publishIssues]
              .sort((a, b) => stepOf(a.path) - stepOf(b.path))
              .map((issue, i) => {
                const step = stepOf(issue.path);
                const field = issue.path.split(".")[1] ?? "";
                const def = template.fields[field];
                const name = def
                  ? labels.field(field, { label: def.label, help: def.help }).label
                  : issue.path;
                return (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-[0.92rem]">
                    <span>
                      <span aria-hidden="true" className="mr-2 text-warning">
                        ⚠
                      </span>
                      {name}
                      {/* Message lisible plutôt que le détail technique de la validation. */}
                      <span className="ml-2 text-muted">
                        {issue.message === "MONEY_GIFT_UNFUNDED"
                          ? t.wizard.unfunded
                          : /received undefined|too_small|>=/i.test(issue.message)
                            ? t.wizard.incomplete
                            : t.wizard.invalid}
                      </span>
                    </span>
                    {step >= 0 && (
                      <Button variant="quiet" onClick={() => onGoTo(step)}>
                        {t.publish.goToStep}
                      </Button>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <ExperienceSettingsPanel detail={fresh} onChange={setFresh} />

      {!republish && eligibility && (
        <section>
          <h3 className="kicker text-muted">{t.publish.license}</h3>
          {eligibility.candidates.length === 0 ? (
            <div className="mt-3">
              <Banner
                tone="warning"
                action={
                  <ButtonLink variant="quiet" href={path("/espace/acheter")}>
                    {t.common.seePlans}
                  </ButtonLink>
                }
              >
                {t.publish.noLicense}
              </Banner>
            </div>
          ) : (
            <fieldset className="mt-3 space-y-2">
              <legend className="sr-only">{t.publish.license}</legend>
              {eligibility.candidates.map((c) => (
                <label
                  key={c.licenseId}
                  className={`flex min-h-14 cursor-pointer items-center gap-4 rounded-xl border px-4 py-3 ${license === c.licenseId ? "border-primary bg-primary/5" : "border-line bg-surface"}`}
                >
                  <input
                    type="radio"
                    name="license"
                    checked={license === c.licenseId}
                    onChange={() => setLicense(c.licenseId)}
                    className="h-5 w-5 accent-[var(--color-primary)]"
                  />
                  <span>
                    <span className="block font-display text-[1.1rem]">
                      {c.requiresExplicitChoice ? t.publish.freeChoice : c.planName}
                    </span>
                    <span className="block text-[0.84rem] text-muted">
                      {t.publish.left(c.publicationsLeft)}
                    </span>
                  </span>
                </label>
              ))}
              {eligibility.candidates.some((c) => c.requiresExplicitChoice) && (
                <p className="text-[0.84rem] text-muted">{t.publish.freeNote}</p>
              )}
            </fieldset>
          )}
        </section>
      )}

      {error && (
        <Banner
          tone="danger"
          action={
            error.plans ? (
              <ButtonLink variant="quiet" href={path("/espace/acheter")}>
                {t.common.seePlans}
              </ButtonLink>
            ) : undefined
          }
        >
          {error.text}
        </Banner>
      )}
      {republish && !fresh.hasUnpublishedChanges ? (
        <Banner tone="success">{t.publish.upToDate}</Banner>
      ) : (
        <Button
          onClick={publish}
          disabled={busy || !ready || (!republish && !license)}
          className="w-full sm:w-auto"
        >
          {busy ? t.publish.submitting : republish ? t.publish.republish : t.publish.submit}
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// L'assistant
// ---------------------------------------------------------------------

export function WizardView() {
  return (
    <RequireSession>
      <Wizard />
    </RequireSession>
  );
}

function Wizard() {
  const { t, api, locale, path } = useAccount();
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<ExperienceDetailResponse | null>(null);
  const [template, setTemplate] = useState<TemplateDetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>({});
  const [disabled, setDisabled] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [save, setSave] = useState<SaveState>("idle");
  const [published, setPublished] = useState<PublishResponse | null>(null);
  const [giftError, setGiftError] = useState<string | null>(null);
  const revision = useRef(0);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Nouvel essai automatique après un échec réseau (référence : la fonction s'appelle elle-même). */
  const retry = useRef<(() => Promise<unknown>) | null>(null);
  const latest = useRef({ fields, disabled });
  useEffect(() => {
    latest.current = { fields, disabled };
  }, [fields, disabled]);

  const apply = useCallback((d: ExperienceDetailResponse, resetContent: boolean) => {
    setDetail(d);
    revision.current = d.contentRevision;
    if (resetContent) {
      setFields(d.content.fields);
      setDisabled(d.content.disabledSections);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const d = await api.experience(id);
        const tpl = await api.template(d.template.slug);
        if (!alive) return;
        setTemplate(tpl);
        apply(d, true);
      } catch (err) {
        if (alive) setLoadError(errorText(err, t.common.unavailable));
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, id, apply, t]);

  /** Enregistrement : contenu complet, révision lue en garde contre l'écrasement d'un autre onglet. */
  const persist = useCallback(async (): Promise<ExperienceDetailResponse | null> => {
    if (timer.current) clearTimeout(timer.current);
    if (!dirty.current || !template) return null;
    dirty.current = false;
    setSave("saving");
    try {
      const d = await api.updateExperience(id, {
        content: {
          fields: cleanFields(template.fields as unknown as Record<string, FieldDef>, latest.current.fields),
          disabledSections: latest.current.disabled,
        },
        expectedRevision: revision.current,
      });
      apply(d, false);
      setSave("saved");
      return d;
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "EXPERIENCE_REVISION_CONFLICT") {
        setSave("conflict");
        return null;
      }
      dirty.current = true;
      setSave("error");
      timer.current = setTimeout(() => void retry.current?.(), 4000);
      return null;
    }
  }, [api, id, template, apply]);

  useEffect(() => {
    retry.current = persist;
  }, [persist]);

  const change = (fieldId: string, value: unknown) => {
    setFields((f) => ({ ...f, [fieldId]: value }));
    dirty.current = true;
    setSave("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(), 900);
  };

  const toggleSection = (sectionId: string, include: boolean) => {
    setDisabled((d) => (include ? d.filter((x) => x !== sectionId) : [...d, sectionId]));
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(), 300);
  };

  // Rien n'est perdu (X4) : on enregistre avant de quitter la page.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  /** Les cadeaux vivent côté API : après chaque ajout ou retrait, la liste et la révision sont relues. */
  const giftOp = async (work: () => Promise<unknown>) => {
    setGiftError(null);
    await persist();
    try {
      await work();
    } catch (err) {
      setGiftError(errorText(err, t.common.unavailable));
      throw err;
    }
    const d = await api.experience(id);
    setDetail(d);
    revision.current = d.contentRevision;
    if (template) {
      const giftFields = Object.entries(template.fields)
        .filter(([, def]) => def.kind === "giftList")
        .map(([k]) => k);
      setFields((f) => ({ ...f, ...Object.fromEntries(giftFields.map((k) => [k, d.content.fields[k]])) }));
    }
  };

  const steps = template?.steps ?? [];
  const labels = useMemo(() => templateLabels(locale, template?.slug ?? ""), [locale, template?.slug]);
  const issueFields = new Set((detail?.publishIssues ?? []).map((i) => i.path.split(".")[1]));
  const reviewIndex = steps.length;
  const go = async (n: number) => {
    await persist();
    setStep(n);
    window.scrollTo({ top: 0 });
  };

  if (loadError)
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <ErrorBanner error={loadError} />
      </div>
    );
  if (!detail || !template) return <FullPageStatus text={t.common.loading} />;
  if (published)
    return (
      <div className="px-5">
        <Published result={published} />
      </div>
    );

  const editable = detail.canEdit;
  const current = steps[step];
  const optionalHere = current && template.sections.find((s) => s.optional && s.id === current.id);
  const optionalElsewhere = template.sections.filter(
    (s) => s.optional && !steps.some((st) => st.id === s.id),
  );
  const sectionOff = optionalHere ? disabled.includes(optionalHere.id) : false;

  const saveLabel = {
    idle: "",
    saving: t.wizard.saving,
    saved: t.wizard.savedAt,
    error: t.wizard.saveError,
    conflict: t.wizard.conflict,
  }[save];

  return (
    <MediaProvider experienceId={id} mediaIds={mediaIdsOf(fields)}>
    <div className="min-h-svh bg-canvas">
      {/* Création : pas de navigation globale (docs/05 §4.2). */}
      <header className="sticky top-0 z-30 border-b border-line bg-paper/[0.98]">
        <div className="mx-auto flex max-w-[80rem] items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link
            href={path("/espace")}
            className="link-draw text-[0.9rem] text-muted"
            onClick={() => void persist()}
          >
            ← {t.wizard.exit}
          </Link>
          <p className="truncate font-display text-[1.1rem]">
            {template.name} · {detail.recipient.displayName}
          </p>
          <div className="flex items-center gap-3">
            <p
              role="status"
              aria-live="polite"
              className={`min-w-24 text-right text-[0.82rem] ${save === "error" || save === "conflict" ? "text-danger" : "text-muted"}`}
            >
              {saveLabel}
            </p>
            {/* Aperçu dans un nouvel onglet, après enregistrement : le brouillon reste ouvert ici. */}
            <Link
              href={path(`/espace/apercu/${id}`)}
              target="_blank"
              onClick={() => void persist()}
              className="inline-flex min-h-9 items-center rounded-full border border-ink/20 px-4 text-[0.85rem] hover:border-ink"
            >
              {t.preview.open}
            </Link>
          </div>
        </div>
      </header>

      {save === "conflict" && (
        <div className="mx-auto max-w-[80rem] px-5 pt-4 sm:px-8">
          <Banner
            tone="danger"
            action={
              <Button variant="quiet" onClick={() => window.location.reload()}>
                {t.wizard.reload}
              </Button>
            }
          >
            {t.wizard.conflict}
          </Banner>
        </div>
      )}
      {!editable && (
        <div className="mx-auto max-w-[80rem] px-5 pt-4 sm:px-8">
          <Banner tone="warning">{t.experiences.suspendedNote}</Banner>
        </div>
      )}

      <div className="mx-auto grid max-w-[80rem] gap-10 px-5 pt-8 pb-32 sm:px-8 lg:grid-cols-[17rem_1fr] lg:pb-16">
        {/* Étapes : liste verticale sur ordinateur, repère compact sur mobile. */}
        <nav aria-label={t.wizard.step(step + 1, steps.length + 1)}>
          <p className="text-[0.88rem] text-muted lg:hidden">
            {t.wizard.step(Math.min(step + 1, steps.length + 1), steps.length + 1)} ·{" "}
            {current ? labels.step(current.id, current.title) : t.wizard.review}
          </p>
          <ol className="hidden space-y-1 lg:block">
            {[...steps, null].map((s, i) => {
              const incomplete = s ? s.fields.some((f) => issueFields.has(f)) : false;
              return (
                <li key={s?.id ?? "review"}>
                  <button
                    type="button"
                    onClick={() => void go(i)}
                    aria-current={i === step ? "step" : undefined}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[0.93rem] ${i === step ? "bg-primary/8 text-primary" : "text-ink/75 hover:bg-ink/5"}`}
                  >
                    <span className="w-5 text-center text-[0.8rem] tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1">{s ? labels.step(s.id, s.title) : t.wizard.review}</span>
                    {s && (
                      <span
                        aria-label={incomplete ? t.wizard.incomplete : t.wizard.complete}
                        className={incomplete ? "text-warning" : "text-success"}
                      >
                        {incomplete ? "⚠" : "✓"}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="min-w-0 max-w-2xl">
          {current ? (
            <div className="space-y-7">
              <h1 className="display text-[clamp(2rem,5vw,2.8rem)]">
                {labels.step(current.id, current.title)}
              </h1>
              {optionalHere && (
                <label className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-surface px-4">
                  <input
                    type="checkbox"
                    checked={!sectionOff}
                    disabled={!editable}
                    onChange={(e) => toggleSection(optionalHere.id, e.target.checked)}
                    className="h-5 w-5 accent-[var(--color-primary)]"
                  />
                  <span className="text-[0.95rem]">
                    {t.wizard.includeSection(labels.section(optionalHere.id))}
                  </span>
                </label>
              )}
              <fieldset
                disabled={!editable || sectionOff}
                className={`space-y-7 ${sectionOff ? "opacity-45" : ""}`}
              >
                {current.fields.map((fieldId) => {
                  const def = template.fields[fieldId] as unknown as FieldDef | undefined;
                  if (!def) return null;
                  const l = labels.field(fieldId, { label: def.label, help: def.help });
                  if (def.kind === "giftList") {
                    const ids = (fields[fieldId] as string[] | undefined) ?? [];
                    const gifts = ids
                      .map((g) => detail.gifts.find((x) => x.id === g))
                      .filter((g): g is GiftResponse => Boolean(g));
                    return (
                      <div key={fieldId} className="space-y-3">
                        {giftError && <Banner tone="danger">{giftError}</Banner>}
                        <GiftStep
                          def={def}
                          gifts={gifts}
                          experienceId={id}
                          onChanged={() => void giftOp(async () => undefined).catch(() => undefined)}
                          onAdd={(type, data, secret) =>
                            giftOp(() =>
                              api.addGift(id, {
                                type: type as never,
                                data,
                                ...(secret ? { protectedData: secret } : {}),
                              }),
                            )
                          }
                          onRemove={(giftId) =>
                            giftOp(() => api.removeGift(id, giftId)).catch(() => undefined)
                          }
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={fieldId}>
                      <FieldInput
                        fieldId={fieldId}
                        def={def}
                        value={fields[fieldId]}
                        labels={l}
                        onChange={(v) => change(fieldId, v)}
                      />
                    </div>
                  );
                })}
              </fieldset>
            </div>
          ) : (
            <div className="space-y-8">
              {optionalElsewhere.length > 0 && (
                <section className="space-y-2">
                  <h2 className="kicker text-muted">{t.wizard.sections}</h2>
                  {optionalElsewhere.map((s) => (
                    <label
                      key={s.id}
                      className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-surface px-4"
                    >
                      <input
                        type="checkbox"
                        checked={!disabled.includes(s.id)}
                        onChange={(e) => toggleSection(s.id, e.target.checked)}
                        className="h-5 w-5 accent-[var(--color-primary)]"
                      />
                      <span className="text-[0.95rem]">{t.wizard.includeSection(labels.section(s.id))}</span>
                    </label>
                  ))}
                </section>
              )}
              <Review
                detail={detail}
                template={template}
                onGoTo={(n) => void go(n)}
                onPublished={setPublished}
                flush={persist}
              />
            </div>
          )}

          {/* Précédent / Suivant : barre fixe en bas sur mobile. */}
          <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line bg-paper/[0.98] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:mt-12 lg:border-0 lg:bg-transparent lg:p-0">
            <Button variant="secondary" onClick={() => void go(step - 1)} disabled={step === 0}>
              {t.wizard.previous}
            </Button>
            {step < reviewIndex && (
              <Button onClick={() => void go(step + 1)}>
                {step === reviewIndex - 1 ? t.wizard.review : t.wizard.next}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
    </MediaProvider>
  );
}

/** Identifiants des photos présentes dans le contenu (pour charger leurs vignettes). */
function mediaIdsOf(fields: Fields): string[] {
  const ids: string[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.mediaId === "string") ids.push(o.mediaId);
      Object.values(o).forEach((x) => typeof x === "object" && visit(x));
    }
  };
  Object.values(fields).forEach(visit);
  return ids;
}
