"use client";

import type { Locale } from "@zaweli/shared-types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ApiRequestError } from "@/account/client";
import { useAccount } from "@/account/session";
import { findTemplate } from "@/content/catalog";
import { ErrorBanner, RecipientForm, useResource } from "./dashboard";
import { Banner, Button, Card, EmptyState, Field, PageTitle, Select } from "./ui";

/** /espace/creer : choisir un modèle parmi ceux que l'API rend disponibles. */
export function CreatePickView() {
  const { t, api, locale, path } = useAccount();
  const templates = useResource(useCallback(() => api.templates(), [api]));
  return (
    <div className="space-y-8">
      <PageTitle title={t.create.title} lead={t.overview.firstText} />
      {templates.error && <ErrorBanner error={templates.error} onRetry={templates.reload} />}
      {templates.data?.length === 0 && <EmptyState title={t.experiences.empty} />}
      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {templates.data?.map((tpl) => {
          const showcase = findTemplate(locale, tpl.slug);
          return (
            <li key={tpl.slug}>
              <Link
                href={path(`/espace/creer/${tpl.slug}`)}
                className="group block overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <div className="aspect-[4/3] overflow-hidden bg-night">
                  {showcase && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={showcase.cover.src} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                  )}
                </div>
                <div className="p-5">
                  <p className="kicker text-muted">{tpl.category.name}</p>
                  <p className="mt-1 font-display text-[1.5rem]">{tpl.name}</p>
                  {tpl.description && <p className="mt-2 line-clamp-2 text-[0.9rem] text-muted">{tpl.description}</p>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** /espace/creer/[modèle] : « Pour qui ? » (W4), puis création du brouillon. */
export function CreateStartView() {
  const { t, api, locale, path } = useAccount();
  const router = useRouter();
  const { template: slug } = useParams<{ template: string }>();
  const template = useResource(useCallback(() => api.template(slug), [api, slug]));
  const recipients = useResource(useCallback(() => api.recipients(), [api]));
  const licenses = useResource(useCallback(() => api.licenses(), [api]));
  const [chosen, setChosen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [language, setLanguage] = useState<Locale>(locale);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const multi = licenses.data?.find((l) => l.status === "active" && l.recipients.max != null && l.recipients.bound.length > 0);
  const selected = chosen ?? (recipients.data?.length === 1 ? recipients.data[0]!.id : null);

  const start = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const draft = await api.createExperience({ templateSlug: slug, recipientId: selected, locale: language });
      router.push(path(`/espace/brouillon/${draft.id}`));
    } catch (err) {
      setError(err instanceof ApiRequestError && err.message ? err.message : t.common.unavailable);
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link href={path("/espace/creer")} className="link-draw text-[0.9rem] text-muted">
          ← {t.create.template} : {template.data?.name ?? slug}
        </Link>
        <div className="mt-6">
          <PageTitle title={t.create.forWho} lead={t.create.forWhoLead} />
        </div>
      </div>
      {(template.error || recipients.error) && <ErrorBanner error={(template.error ?? recipients.error)!} />}
      {multi && multi.recipients.max != null && (
        <Banner tone="info">
          {t.create.multiNote(multi.recipients.bound.map((r) => r.displayName).join(", "), multi.recipients.max - multi.recipients.bound.length)}
        </Banner>
      )}

      <fieldset className="space-y-3">
        <legend className="sr-only">{t.create.forWho}</legend>
        {recipients.data?.map((r) => (
          <label
            key={r.id}
            className={`flex min-h-14 cursor-pointer items-center gap-4 rounded-xl border px-4 transition-colors ${
              selected === r.id ? "border-primary bg-primary/5" : "border-line bg-surface hover:border-ink/40"
            }`}
          >
            <input type="radio" name="recipient" className="h-4 w-4 accent-[var(--color-primary)]" checked={selected === r.id} onChange={() => setChosen(r.id)} />
            <span className="font-display text-[1.15rem]">{r.displayName}</span>
            {r.note && <span className="truncate text-[0.85rem] text-muted">{r.note}</span>}
          </label>
        ))}
      </fieldset>

      {adding || recipients.data?.length === 0 ? (
        <Card className="p-6">
          <p className="mb-4 font-display text-[1.25rem]">{t.create.newRecipient}</p>
          <RecipientForm
            onSaved={(r) => {
              setAdding(false);
              setChosen(r.id);
              void recipients.reload();
            }}
            onCancel={recipients.data?.length ? () => setAdding(false) : undefined}
          />
        </Card>
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          + {t.create.newRecipient}
        </Button>
      )}

      <Field label={t.create.language} hint={t.create.languageHelp}>
        {(p) => (
          <Select {...p} value={language} onChange={(e) => setLanguage(e.target.value as Locale)} className="max-w-xs">
            <option value="fr">Français</option>
            <option value="en">English</option>
          </Select>
        )}
      </Field>

      {error && <Banner tone="danger">{error}</Banner>}
      <Button onClick={start} disabled={!selected || busy || !template.data}>
        {busy ? t.common.loading : t.create.start}
      </Button>
    </div>
  );
}
