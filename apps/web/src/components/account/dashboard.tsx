"use client";

import { COUNTRY_CODES, type ExperienceSummaryResponse, type LicenseResponse, type Locale, type RecipientResponse } from "@zaweli/shared-types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiRequestError, getSupabase, publicOrigin } from "@/account/client";
import { useAccount } from "@/account/session";
import { QrCode } from "./qr-code";
import { Banner, Button, ButtonLink, Card, EmptyState, Field, formatDate, Gauge, PageTitle, Select, StatusBadge, TextArea, TextInput } from "./ui";

/** Chargement d'une ressource de l'API, avec erreur lisible et rechargement. */
export function useResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useAccount();
  const reload = useCallback(async () => {
    try {
      setData(await load());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError && err.message ? err.message : t.common.unavailable);
    }
  }, [load, t]);
  useEffect(() => {
    queueMicrotask(() => void reload());
  }, [reload]);
  return { data, error, reload, setData };
}

export function ErrorBanner({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useAccount();
  return (
    <Banner tone="danger" action={onRetry && <Button variant="quiet" onClick={onRetry}>{t.common.retry}</Button>}>
      {error}
    </Banner>
  );
}

export const publicUrl = (slug: string) => `${publicOrigin()}/g/${slug}`;

export function CopyButton({ text, label }: { text: string; label: string }) {
  const { t } = useAccount();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <span aria-live="polite">{copied ? t.common.copied : label}</span>
    </Button>
  );
}

// ---------------------------------------------------------------------
// Vue d'ensemble (W9)
// ---------------------------------------------------------------------

function LicenseCard({ license, locale }: { license: LicenseResponse; locale: Locale }) {
  const { t } = useAccount();
  const validity = license.endsAt
    ? t.licenses.validUntil(formatDate(license.endsAt, locale))
    : license.startsAt
      ? t.licenses.noEnd
      : t.licenses.startsOnPublish;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-[1.35rem]">{license.plan.name}</p>
          <p className="mt-1 text-[0.85rem] text-muted">
            {t.licenseSource[license.source]} · {validity}
          </p>
        </div>
        <StatusBadge status={license.status} label={t.licenseStatus[license.status]} />
      </div>
      <div className="mt-5 space-y-4">
        <Gauge label={t.licenses.creations} used={license.publications.used} max={license.publications.max} unlimitedLabel={t.licenses.unlimited} />
        {license.recipients.max != null && (
          <div>
            <Gauge label={t.licenses.recipients} used={license.recipients.bound.length} max={license.recipients.max} unlimitedLabel={t.licenses.unlimited} />
            {license.recipients.bound.length > 0 && (
              <p className="mt-1.5 text-[0.82rem] text-muted">{license.recipients.bound.map((r) => r.displayName).join(", ")}</p>
            )}
          </div>
        )}
        {license.ai.max > 0 && <Gauge label={t.licenses.ai} used={license.ai.used} max={license.ai.max} unlimitedLabel={t.licenses.unlimited} />}
      </div>
      {license.status === "expired" && <p className="mt-4 text-[0.85rem] text-muted">{t.licenses.expiredNote}</p>}
    </Card>
  );
}

function ExperienceRow({ e, onChanged }: { e: ExperienceSummaryResponse; onChanged: () => void }) {
  const { t, api, locale, path } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const act = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError && err.message ? err.message : t.common.unavailable);
    }
    setBusy(false);
  };
  const editable = e.status === "draft" || e.status === "published" || e.status === "disabled";
  return (
    <li className="py-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="truncate font-display text-[1.2rem]">{e.title ?? t.experiences.for(e.recipient.displayName)}</p>
            <StatusBadge status={e.status} label={t.status[e.status]} />
          </div>
          <p className="mt-1 text-[0.85rem] text-muted">
            {e.template.name} · {t.experiences.for(e.recipient.displayName)} ·{" "}
            {e.lastPublishedAt ? t.experiences.published(formatDate(e.lastPublishedAt, locale)) : t.experiences.updated(formatDate(e.updatedAt, locale))}
          </p>
          {e.status === "suspended" && <p className="mt-1 text-[0.85rem] text-danger">{t.experiences.suspendedNote}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <ButtonLink variant="secondary" href={path(`/espace/brouillon/${e.id}`)}>
              {t.experiences.open}
            </ButtonLink>
          )}
          {e.slug && e.status === "published" && <CopyButton text={publicUrl(e.slug)} label={t.experiences.copyLink} />}
          {e.slug && e.status === "published" && (
            <Button variant="quiet" aria-expanded={showQr} onClick={() => setShowQr((v) => !v)}>
              {t.experiences.qr}
            </Button>
          )}
          {e.status === "published" && (
            <Button variant="quiet" disabled={busy} onClick={() => act(() => api.setEnabled(e.id, false))}>
              {t.experiences.disable}
            </Button>
          )}
          {e.status === "disabled" && (
            <Button variant="quiet" disabled={busy} onClick={() => act(() => api.setEnabled(e.id, true))}>
              {t.experiences.enable}
            </Button>
          )}
          {e.status !== "suspended" && (
            <Button variant="quiet" aria-expanded={duplicating} onClick={() => setDuplicating((v) => !v)}>
              {t.experiences.duplicate}
            </Button>
          )}
          {(e.status === "draft" || e.status === "disabled") && (
            <Button variant="danger" disabled={busy} onClick={() => window.confirm(t.experiences.confirmRemove) && act(() => api.removeExperience(e.id))}>
              {t.experiences.remove}
            </Button>
          )}
        </div>
      </div>
      {duplicating && <DuplicateForm experienceId={e.id} onCancel={() => setDuplicating(false)} />}
      {showQr && e.slug && e.status === "published" && (
        <div className="mt-4 rounded-xl border border-line bg-surface p-4">
          <QrCode url={publicUrl(e.slug)} slug={e.slug} />
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}
    </li>
  );
}

/** Nouvelle expérience pour une autre personne : même modèle et même contenu, nouveau brouillon. */
function DuplicateForm({ experienceId, onCancel }: { experienceId: string; onCancel: () => void }) {
  const { t, api, path } = useAccount();
  const router = useRouter();
  const recipients = useResource(useCallback(() => api.recipients(), [api]));
  const [recipientId, setRecipientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!recipientId) return;
    setBusy(true);
    setError(null);
    try {
      const copy = await api.duplicate(experienceId, recipientId);
      router.push(path(`/espace/brouillon/${copy.id}`));
    } catch (err) {
      setError(err instanceof ApiRequestError && err.message ? err.message : t.common.unavailable);
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-line bg-surface p-4">
      <p className="text-[0.92rem]">{t.experiences.duplicateLead}</p>
      <Field label={t.experiences.duplicateFor}>
        {(p) => (
          <Select {...p} value={recipientId} onChange={(ev) => setRecipientId(ev.target.value)} required>
            <option value="">—</option>
            {recipients.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.displayName}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {error && <Banner tone="danger">{error}</Banner>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !recipientId}>
          {busy ? t.common.saving : t.experiences.duplicateSubmit}
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}

export function OverviewView() {
  const { t, api, locale, path, state } = useAccount();
  const experiences = useResource(useCallback(() => api.experiences(), [api]));
  const licenses = useResource(useCallback(() => api.licenses(), [api]));
  const profile = state.kind === "signed-in" ? state.profile : null;

  const drafts = (experiences.data ?? []).filter((e) => e.status === "draft").slice(0, 3);
  const published = (experiences.data ?? []).filter((e) => e.status !== "draft").slice(0, 5);
  const active = (licenses.data ?? []).filter((l) => l.status === "active");
  const isNew = experiences.data?.length === 0;

  return (
    <div className="space-y-12">
      <PageTitle title={t.overview.hello(profile?.displayName ?? null)} lead={t.overview.lead} />
      {profile && !profile.emailVerified && (
        <Banner tone="warning" action={<ButtonLink variant="quiet" href={`${path("/verifier")}?email=${encodeURIComponent(profile.email ?? "")}`}>{t.overview.verifyAction}</ButtonLink>}>
          {t.overview.verifyBanner}
        </Banner>
      )}
      {experiences.error && <ErrorBanner error={experiences.error} onRetry={experiences.reload} />}

      {isNew && (
        <EmptyState
          title={t.overview.firstTitle}
          text={t.overview.firstText}
          action={<ButtonLink href={path("/espace/creer")}>{t.overview.chooseTemplate}</ButtonLink>}
        />
      )}

      <section aria-labelledby="licences">
        <h2 id="licences" className="kicker text-muted">
          {t.overview.licenses}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((l) => (
            <LicenseCard key={l.id} license={l} locale={locale} />
          ))}
          {licenses.data && active.length === 0 && <p className="text-[0.95rem] text-muted">{t.overview.noLicense}</p>}
        </div>
      </section>

      {!isNew && (
        <>
          <section aria-labelledby="reprendre">
            <h2 id="reprendre" className="kicker text-muted">
              {t.overview.resume}
            </h2>
            {drafts.length === 0 ? (
              <p className="mt-4 text-[0.95rem] text-muted">{t.overview.noDrafts}</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {drafts.map((e) => (
                  <ExperienceRow key={e.id} e={e} onChanged={experiences.reload} />
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="dernieres">
            <div className="flex items-baseline justify-between">
              <h2 id="dernieres" className="kicker text-muted">
                {t.overview.latest}
              </h2>
              <Link href={path("/espace/experiences")} className="link-draw text-[0.9rem]">
                {t.overview.seeAll}
              </Link>
            </div>
            {published.length === 0 ? (
              <p className="mt-4 text-[0.95rem] text-muted">{t.overview.noPublished}</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {published.map((e) => (
                  <ExperienceRow key={e.id} e={e} onChanged={experiences.reload} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Mes expériences
// ---------------------------------------------------------------------

export function ExperiencesView() {
  const { t, api, path } = useAccount();
  const [filter, setFilter] = useState<"all" | "draft" | "published" | "disabled">("all");
  const experiences = useResource(useCallback(() => api.experiences(), [api]));
  const list = (experiences.data ?? []).filter((e) => filter === "all" || e.status === filter);
  return (
    <div className="space-y-8">
      <PageTitle title={t.experiences.title} action={<ButtonLink href={path("/espace/creer")}>{t.nav.newExperience}</ButtonLink>} />
      <div role="group" className="flex flex-wrap gap-2">
        {(["all", "draft", "published", "disabled"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-11 rounded-full border px-4 text-[0.9rem] ${filter === f ? "border-ink bg-ink text-paper" : "border-line bg-surface hover:border-ink/40"}`}
          >
            {t.experiences.filters[f]}
          </button>
        ))}
      </div>
      {experiences.error && <ErrorBanner error={experiences.error} onRetry={experiences.reload} />}
      {experiences.data && list.length === 0 ? (
        <EmptyState title={t.experiences.empty} action={<ButtonLink href={path("/espace/creer")}>{t.overview.chooseTemplate}</ButtonLink>} />
      ) : (
        <ul className="divide-y divide-line">
          {list.map((e) => (
            <ExperienceRow key={e.id} e={e} onChanged={experiences.reload} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Destinataires
// ---------------------------------------------------------------------

export function RecipientForm({ initial, onSaved, onCancel }: { initial?: RecipientResponse; onSaved: (r: RecipientResponse) => void; onCancel?: () => void }) {
  const { t, api } = useAccount();
  const [name, setName] = useState(initial?.displayName ?? "");
  const [email, setEmail] = useState(initial?.contactEmail ?? "");
  const [phone, setPhone] = useState(initial?.contactPhone ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = { displayName: name.trim(), contactEmail: email.trim() || null, contactPhone: phone.trim() || null, note: note.trim() || null };
    try {
      onSaved(initial ? await api.updateRecipient(initial.id, body) : await api.createRecipient(body));
    } catch (err) {
      setError(err instanceof ApiRequestError && err.message ? err.message : t.common.unavailable);
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t.recipients.name} hint={initial?.boundLicenseIds.length ? t.recipients.boundHelp : undefined}>
        {(p) => <TextInput {...p} required maxLength={60} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.recipients.email} optionalLabel={t.common.optional}>
          {(p) => <TextInput {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label={t.recipients.phone} optionalLabel={t.common.optional}>
          {(p) => <TextInput {...p} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
        </Field>
      </div>
      <Field label={t.recipients.note} optionalLabel={t.common.optional} counter={`${note.length}/280`}>
        {(p) => <TextArea {...p} rows={2} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      {error && <Banner tone="danger">{error}</Banner>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? t.common.saving : t.common.save}
        </Button>
        {onCancel && (
          <Button variant="quiet" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}

export function RecipientsView() {
  const { t, api } = useAccount();
  const recipients = useResource(useCallback(() => api.recipients(), [api]));
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const remove = async (id: string) => {
    if (!window.confirm(t.recipients.confirmRemove)) return;
    try {
      await api.removeRecipient(id);
      await recipients.reload();
    } catch (err) {
      setError(err instanceof ApiRequestError && err.message ? err.message : t.common.unavailable);
    }
  };
  return (
    <div className="space-y-8">
      <PageTitle
        title={t.recipients.title}
        lead={t.recipients.lead}
        action={editing !== "new" && <Button onClick={() => setEditing("new")}>{t.recipients.add}</Button>}
      />
      {editing === "new" && (
        <Card className="p-6">
          <RecipientForm onSaved={() => (setEditing(null), void recipients.reload())} onCancel={() => setEditing(null)} />
        </Card>
      )}
      {(recipients.error || error) && <ErrorBanner error={(recipients.error ?? error)!} onRetry={recipients.reload} />}
      {recipients.data?.length === 0 && editing !== "new" && <EmptyState title={t.recipients.empty} />}
      <ul className="grid gap-4 md:grid-cols-2">
        {recipients.data?.map((r) => (
          <li key={r.id}>
            <Card className="p-5">
              {editing === r.id ? (
                <RecipientForm initial={r} onSaved={() => (setEditing(null), void recipients.reload())} onCancel={() => setEditing(null)} />
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-[1.3rem]">{r.displayName}</p>
                    {(r.contactEmail || r.contactPhone) && (
                      <p className="mt-1 truncate text-[0.86rem] text-muted">{[r.contactEmail, r.contactPhone].filter(Boolean).join(" · ")}</p>
                    )}
                    {r.note && <p className="mt-2 text-[0.9rem] text-ink/80">{r.note}</p>}
                    {r.boundLicenseIds.length > 0 && <p className="mt-2 text-[0.8rem] text-gold">{t.recipients.bound}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <Button variant="quiet" onClick={() => setEditing(r.id)}>
                      {t.common.edit}
                    </Button>
                    {r.boundLicenseIds.length === 0 && (
                      <Button variant="danger" onClick={() => remove(r.id)}>
                        {t.common.delete}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------
// Licences (W10)
// ---------------------------------------------------------------------

export function LicensesView() {
  const { t, api, locale, path } = useAccount();
  const licenses = useResource(useCallback(() => api.licenses(), [api]));
  return (
    <div className="space-y-8">
      <PageTitle
        title={t.licenses.title}
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={path("/espace/acheter")}>{t.purchase.title}</ButtonLink>
            <ButtonLink variant="secondary" href={path("/espace/achats")}>
              {t.nav.orders}
            </ButtonLink>
          </div>
        }
      />
      {licenses.error && <ErrorBanner error={licenses.error} onRetry={licenses.reload} />}
      {licenses.data?.length === 0 && <EmptyState title={t.licenses.empty} text={t.overview.noLicense} />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {licenses.data?.map((l) => (
          <LicenseCard key={l.id} license={l} locale={locale} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Mon compte
// ---------------------------------------------------------------------

/** Pays nommés dans la langue choisie et triés selon elle (Intl : aucune liste de noms à maintenir). */
function countryOptions(locale: Locale) {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return COUNTRY_CODES.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name, locale));
}

export function SettingsView() {
  const { t, api, state, refreshProfile, signOut, path } = useAccount();
  const profile = state.kind === "signed-in" ? state.profile : null;
  const [name, setName] = useState(profile?.displayName ?? "");
  const [language, setLanguage] = useState<Locale>(profile?.locale ?? "fr");
  const [news, setNews] = useState(profile?.marketingOptIn ?? false);
  const [expiry, setExpiry] = useState(profile?.notifyLicenseExpiry ?? true);
  // Un pays seulement détecté n'est pas un choix : le champ reste « Non précisé » jusqu'à ce que la personne choisisse.
  const [country, setCountry] = useState(profile?.countrySource === "declared" ? (profile.countryCode ?? "") : "");
  const countries = useMemo(() => countryOptions(language), [language]);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const declared = profile?.countrySource === "declared" ? (profile.countryCode ?? "") : "";
      await api.updateProfile({
        displayName: name.trim() || null,
        locale: language,
        marketingOptIn: news,
        notifyLicenseExpiry: expiry,
        // Envoyé seulement s'il change : null efface le choix et laisse l'API déduire le pays de la connexion.
        ...(country !== declared ? { countryCode: country || null } : {}),
      });
      await refreshProfile();
      setMessage({ tone: "success", text: t.common.saved });
    } catch (err) {
      setMessage({ tone: "danger", text: err instanceof ApiRequestError && err.message ? err.message : t.common.unavailable });
    }
    setBusy(false);
  };
  const email = state.kind === "signed-in" ? state.session.user.email : "";
  const google = state.kind === "signed-in" && state.session.user.app_metadata.provider === "google";
  return (
    <div className="max-w-xl space-y-10">
      <PageTitle title={t.settings.title} />
      <section className="space-y-5">
        <h2 className="kicker text-muted">{t.settings.profile}</h2>
        <p className="text-[0.95rem]">
          {email}{" "}
          {profile && (
            <StatusBadge status={profile.emailVerified ? "active" : "pending"} label={profile.emailVerified ? t.settings.emailVerified : t.settings.emailNotVerified} />
          )}
        </p>
        <form onSubmit={save} className="space-y-5">
          <Field label={t.settings.displayName} optionalLabel={t.common.optional}>
            {(p) => <TextInput {...p} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label={t.settings.language}>
            {(p) => (
              <Select {...p} value={language} onChange={(e) => setLanguage(e.target.value as Locale)}>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </Select>
            )}
          </Field>
          <Field label={t.settings.country} hint={t.settings.countryHint} optionalLabel={t.common.optional}>
            {(p) => (
              <Select {...p} value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">{t.settings.countryUnset}</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-[0.92rem]">{t.settings.emails}</legend>
            <p className="text-[0.84rem] text-muted">{t.settings.emailsHint}</p>
            <label className="flex min-h-11 items-center gap-3 text-[0.95rem]">
              <input type="checkbox" className="h-5 w-5 accent-[var(--color-primary)]" checked={expiry} onChange={(e) => setExpiry(e.target.checked)} />
              {t.settings.notifyExpiry}
            </label>
            <label className="flex min-h-11 items-center gap-3 text-[0.95rem]">
              <input type="checkbox" className="h-5 w-5 accent-[var(--color-primary)]" checked={news} onChange={(e) => setNews(e.target.checked)} />
              {t.settings.notifyNews}
            </label>
          </fieldset>
          {message && <Banner tone={message.tone}>{message.text}</Banner>}
          <Button type="submit" disabled={busy}>
            {busy ? t.common.saving : t.common.save}
          </Button>
        </form>
      </section>
      <section className="space-y-4 border-t border-line pt-8">
        <h2 className="kicker text-muted">{t.settings.security}</h2>
        <div className="flex flex-wrap gap-2">
          {!google && (
            <ButtonLink variant="secondary" href={`${path("/mot-de-passe")}?email=${encodeURIComponent(email ?? "")}`}>
              {t.settings.changePassword}
            </ButtonLink>
          )}
          <Button
            variant="quiet"
            onClick={async () => {
              await getSupabase().auth.signOut({ scope: "global" }).catch(() => undefined);
              await signOut();
            }}
          >
            {t.settings.signOutAll}
          </Button>
        </div>
      </section>
      <DataSection email={email ?? ""} />
    </div>
  );
}

/** Mes données : export (JSON) et suppression du compte, confirmée en retapant l'adresse. */
function DataSection({ email }: { email: string }) {
  const { t, api, signOut } = useAccount();
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const download = async () => {
    setError(null);
    try {
      const data = await api.exportData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "zaweli-mes-donnees.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof ApiRequestError && err.message ? err.message : t.common.unavailable);
    }
  };
  const remove = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(confirm.trim());
      await signOut();
    } catch (err) {
      setError(err instanceof ApiRequestError && err.message ? err.message : t.common.unavailable);
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4 border-t border-line pt-8">
      <h2 className="kicker text-muted">{t.settings.data}</h2>
      <div>
        <Button variant="secondary" onClick={() => void download()}>
          {t.settings.export}
        </Button>
        <p className="mt-2 text-[0.84rem] text-muted">{t.settings.exportHint}</p>
      </div>
      {!open ? (
        <Button variant="danger" onClick={() => setOpen(true)}>
          {t.settings.deleteAccount}
        </Button>
      ) : (
        <form onSubmit={remove} className="space-y-3 rounded-xl border border-danger/30 bg-danger/5 p-4">
          <p className="text-[0.92rem]">{t.settings.deleteWarning}</p>
          <Field label={t.settings.deleteConfirm(email)}>
            {(p) => <TextInput {...p} type="email" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={busy || confirm.trim().toLowerCase() !== email.toLowerCase()}>
              {busy ? t.common.saving : t.settings.deleteSubmit}
            </Button>
            <Button variant="quiet" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      )}
      {error && <Banner tone="danger">{error}</Banner>}
    </section>
  );
}
