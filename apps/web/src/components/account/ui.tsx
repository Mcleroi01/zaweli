"use client";

import Link from "next/link";
import { type ComponentProps, type ReactNode, useId, useState } from "react";

/** Composants de l'espace client : cibles d'au moins 44 px, focus visible, libellés reliés (WCAG 2.2 AA). */

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export const buttonClass = {
  primary: `inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[0.95rem] text-paper transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 ${focus}`,
  secondary: `inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-ink/20 bg-surface px-6 text-[0.95rem] text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-50 ${focus}`,
  quiet: `inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-[0.92rem] text-ink/75 transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-50 ${focus}`,
  danger: `inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-[0.92rem] text-danger transition-colors hover:bg-danger/10 disabled:opacity-50 ${focus}`,
};

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: keyof typeof buttonClass }) {
  return <button type="button" {...props} className={`${buttonClass[variant]} ${className}`} />;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: keyof typeof buttonClass }) {
  return <Link {...props} className={`${buttonClass[variant]} ${className}`} />;
}

const inputClass = `mt-1.5 block w-full rounded-xl border border-line bg-surface px-3.5 text-[1rem] text-ink placeholder:text-muted/70 transition-colors focus:border-ink/60 focus:outline-none aria-[invalid=true]:border-danger ${focus}`;

type FieldProps = {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Compteur affiché à droite du libellé (« 42/80 »). */
  counter?: string;
  optionalLabel?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
};

export function Field({ label, hint, error, counter, optionalLabel, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[0.92rem] text-ink">
          {label}
          {optionalLabel && <span className="ml-1.5 text-[0.82rem] text-muted">({optionalLabel})</span>}
        </label>
        {counter && <span className="shrink-0 text-[0.8rem] text-muted tabular-nums">{counter}</span>}
      </div>
      {children({ id, "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined, "aria-invalid": error ? true : undefined })}
      {hint && (
        <p id={hintId} className="mt-1.5 text-[0.84rem] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-[0.84rem] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} h-12 ${props.className ?? ""}`} />;
}

export function TextArea(props: ComponentProps<"textarea">) {
  return <textarea rows={4} {...props} className={`${inputClass} py-3 leading-relaxed ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${inputClass} h-12 ${props.className ?? ""}`} />;
}

export function PasswordInput({ showLabel, hideLabel, ...props }: ComponentProps<"input"> & { showLabel: string; hideLabel: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <TextInput {...props} type={visible ? "text" : "password"} className="pr-24" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        className={`absolute top-1.5 right-1.5 h-12 rounded-lg px-3 text-[0.85rem] text-muted hover:text-ink ${focus}`}
      >
        {visible ? hideLabel : showLabel}
      </button>
    </div>
  );
}

const TONES = {
  info: "border-info/30 bg-info/5 text-info",
  success: "border-success/30 bg-success/5 text-success",
  warning: "border-warning/30 bg-warning/5 text-warning",
  danger: "border-danger/30 bg-danger/5 text-danger",
};
const ICONS = { info: "i", success: "✓", warning: "!", danger: "!" };

/** Bandeau : la couleur n'est jamais seule, une icône et un texte l'accompagnent. */
export function Banner({ tone = "info", children, action }: { tone?: keyof typeof TONES; children: ReactNode; action?: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-[0.92rem] ${TONES[tone]}`}>
      <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current text-[0.75rem] font-semibold">
        {ICONS[tone]}
      </span>
      <div className="min-w-0 flex-1 text-ink">{children}</div>
      {action}
    </div>
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div {...props} className={`rounded-[var(--radius-card)] border border-line bg-surface ${className}`} />;
}

const STATUS_TONE: Record<string, string> = {
  draft: "bg-ink/5 text-ink/80",
  published: "bg-success/10 text-success",
  disabled: "bg-warning/10 text-warning",
  suspended: "bg-danger/10 text-danger",
  deleted: "bg-ink/5 text-muted",
  active: "bg-success/10 text-success",
  expired: "bg-ink/5 text-muted",
  pending: "bg-warning/10 text-warning",
  revoked: "bg-danger/10 text-danger",
  refunded: "bg-ink/5 text-muted",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.78rem] ${STATUS_TONE[status] ?? "bg-ink/5"}`}>{label}</span>;
}

export function PageTitle({ title, lead, action }: { title: string; lead?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="display text-[clamp(2rem,5vw,2.8rem)]">{title}</h1>
        {lead && <p className="mt-2 max-w-xl text-[1rem] text-muted">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <Card className="px-6 py-12 text-center">
      <p className="font-display text-[1.5rem]">{title}</p>
      {text && <p className="mx-auto mt-2 max-w-md text-[0.95rem] text-muted">{text}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </Card>
  );
}

/** Jauge de quota : valeur et maximum écrits en toutes lettres à côté de la barre. */
export function Gauge({ label, used, max, unlimitedLabel }: { label: string; used: number; max: number | null; unlimitedLabel: string }) {
  const ratio = max ? Math.min(1, used / max) : 0;
  return (
    <div>
      <div className="flex justify-between text-[0.86rem]">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">
          {used} / {max ?? unlimitedLabel}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${max ? ratio * 100 : 8}%` }} />
      </div>
    </div>
  );
}

export const formatDate = (iso: string | null, locale: string) =>
  iso ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)) : "";
