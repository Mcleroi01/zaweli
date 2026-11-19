"use client";

import { AUDIT_ACTOR_TYPES, type AdminAuditQuery, type AuditItem } from "@zaweli/shared-types";
import { Fragment, useEffect, useState } from "react";
import { useAdmin } from "@/components/providers";
import { Card, ErrorState, Note, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { useData } from "@/lib/use-data";

const ACTORS: Record<(typeof AUDIT_ACTOR_TYPES)[number], string> = {
  user: "Utilisateur",
  admin: "Administrateur",
  system: "Système",
  provider: "Prestataire",
  anonymous: "Anonyme",
};

type Filters = Pick<AdminAuditQuery, "action" | "actorType" | "entityType" | "entityId" | "from" | "to">;

export default function AuditPage() {
  const { api, tz } = useAdmin();
  const facets = useData("audit-facets", () => api.auditFacets());
  const [filters, setFilters] = useState<Filters>({});
  const [draftId, setDraftId] = useState("");
  const [items, setItems] = useState<AuditItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify(filters);

  /** Page suivante (geste de l'utilisateur). */
  const loadMore = async () => {
    if (!cursor) return;
    setLoading(true);
    try {
      const page = await api.audit({ ...filters, limit: 50, cursor });
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  };

  // Nouveau filtre (ou nouvel essai) : on repart du plus récent.
  useEffect(() => {
    let alive = true;
    queueMicrotask(() => alive && setLoading(true));
    api
      .audit({ ...filters, limit: 50 })
      .then((page) => {
        if (!alive) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Chargement impossible."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` résume les filtres
  }, [key, retry, api]);

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const field = "h-9 min-w-0 rounded-lg border border-line bg-surface px-2 text-[0.85rem] outline-none focus:border-ink-2";

  return (
    <>
      <PageHeader title="Journal d'audit" description="Chaque geste sensible, du plus récent au plus ancien. Le journal est en ajout seul : rien ne s'y modifie ni ne s'efface." />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-[0.78rem] text-muted">
          Action
          <select value={filters.action ?? ""} onChange={(e) => set({ action: e.target.value || undefined })} className={`${field} mt-1 block`}>
            <option value="">Toutes</option>
            {facets.data?.actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[0.78rem] text-muted">
          Acteur
          <select value={filters.actorType ?? ""} onChange={(e) => set({ actorType: (e.target.value || undefined) as Filters["actorType"] })} className={`${field} mt-1 block`}>
            <option value="">Tous</option>
            {AUDIT_ACTOR_TYPES.map((a) => (
              <option key={a} value={a}>
                {ACTORS[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[0.78rem] text-muted">
          Objet
          <select value={filters.entityType ?? ""} onChange={(e) => set({ entityType: e.target.value || undefined })} className={`${field} mt-1 block`}>
            <option value="">Tous</option>
            {facets.data?.entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[0.78rem] text-muted">
          Du
          <input type="date" value={filters.from ?? ""} max={filters.to} onChange={(e) => set({ from: e.target.value || undefined })} className={`${field} mt-1 block`} />
        </label>
        <label className="text-[0.78rem] text-muted">
          Au
          <input type="date" value={filters.to ?? ""} min={filters.from} onChange={(e) => set({ to: e.target.value || undefined })} className={`${field} mt-1 block`} />
        </label>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            set({ entityId: draftId.trim() || undefined });
          }}
        >
          <label className="text-[0.78rem] text-muted">
            Identifiant de l&apos;objet
            <input value={draftId} onChange={(e) => setDraftId(e.target.value)} placeholder="uuid…" className={`${field} mt-1 block w-56 font-mono`} />
          </label>
          <button type="submit" className="h-9 rounded-lg border border-line px-3 text-[0.85rem] hover:bg-raised">
            Chercher
          </button>
        </form>
        {Object.values(filters).some(Boolean) && (
          <button
            type="button"
            onClick={() => {
              setFilters({});
              setDraftId("");
            }}
            className="h-9 px-2 text-[0.85rem] text-ink-2 underline-offset-4 hover:underline"
          >
            Effacer les filtres
          </button>
        )}
      </div>
      <p className="-mt-2 mb-4 text-[0.75rem] text-muted">Dates du filtre en UTC ; heures affichées dans votre fuseau ({tz}).</p>

      {error && <ErrorState message={error} onRetry={() => setRetry((n) => n + 1)} />}
      <Card refreshing={loading && items.length > 0}>
        <div className="relative overflow-x-auto">
          <table className="tabular w-full text-[0.85rem]">
            <thead className="text-left text-ink-2">
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Date
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Acteur
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Action
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Objet
                </th>
                <th scope="col" className="py-2 font-medium">
                  <span className="sr-only">Détail</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <Fragment key={item.id}>
                  <tr className="border-b border-line align-top">
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(item.occurredAt, tz)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <span className="rounded-md bg-raised px-1.5 py-0.5 text-[0.78rem]">{ACTORS[item.actorType]}</span>
                      {item.actorId && (
                        <span className="ml-2 font-mono text-[0.72rem] text-muted" title={item.actorId}>
                          {item.actorId.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-mono text-[0.8rem] whitespace-nowrap">{item.action}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {item.entityType}
                      {item.entityId && (
                        <button type="button" onClick={() => { setDraftId(item.entityId!); set({ entityId: item.entityId! }); }} className="ml-2 font-mono text-[0.72rem] text-muted underline-offset-2 hover:underline" title="Voir l'historique de cet objet">
                          {item.entityId.slice(0, 8)}
                        </button>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <button type="button" aria-expanded={open === item.id} onClick={() => setOpen((o) => (o === item.id ? null : item.id))} className="text-[0.8rem] text-ink-2 hover:text-ink">
                        {open === item.id ? "Masquer" : "Détail"}
                      </button>
                    </td>
                  </tr>
                  {open === item.id && (
                    <tr className="border-b border-line bg-raised">
                      <td colSpan={5} className="px-3 py-3">
                        <dl className="grid gap-x-6 gap-y-1 text-[0.8rem] sm:grid-cols-[8rem_minmax(0,1fr)]">
                          <dt className="text-muted">N° d&apos;entrée</dt>
                          <dd className="font-mono">{item.id}</dd>
                          <dt className="text-muted">Acteur</dt>
                          <dd className="font-mono break-all">{item.actorId ?? "—"}</dd>
                          <dt className="text-muted">Objet</dt>
                          <dd className="font-mono break-all">{item.entityId ?? "—"}</dd>
                          <dt className="text-muted">Requête</dt>
                          <dd className="font-mono break-all">{item.requestId ?? "—"}</dd>
                          <dt className="text-muted">Données</dt>
                          <dd>
                            <pre className="relative overflow-x-auto rounded-md bg-surface p-2 text-[0.75rem] whitespace-pre-wrap">{JSON.stringify(item.data, null, 2)}</pre>
                          </dd>
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !items.length && !error && <p className="py-8 text-center text-sm text-muted">Aucune entrée ne correspond à ces filtres.</p>}
        <div className="mt-4 flex items-center justify-between gap-3 text-[0.82rem] text-muted">
          <span>{items.length} entrées affichées</span>
          {cursor ? (
            <button type="button" disabled={loading} onClick={() => void loadMore()} className="h-9 rounded-lg border border-line px-4 text-ink hover:bg-raised disabled:opacity-60">
              {loading ? "Chargement…" : "Charger plus"}
            </button>
          ) : (
            items.length > 0 && <span>Début du journal atteint.</span>
          )}
        </div>
      </Card>
      {facets.error && (
        <div className="mt-3">
          <Note tone="warn">Filtres indisponibles : {facets.error}</Note>
        </div>
      )}
    </>
  );
}
