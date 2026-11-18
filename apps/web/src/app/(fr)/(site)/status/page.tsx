import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@zaweli/ui";
import { fetchHealth } from "@/lib/api";

export const metadata: Metadata = { title: "État des services", robots: { index: false, follow: false } };

/** Donnée non mise en cache : rendue à la demande dans un Suspense (cacheComponents). */
async function ApiHealth() {
  const result = await fetchHealth();

  if (!result.reachable) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <Badge tone="danger">API injoignable</Badge>
        <p className="mt-3 text-sm text-muted">
          Vérifie que l&apos;API tourne (<code>pnpm dev</code>) et que Supabase est démarré (<code>pnpm db:start</code>).
        </p>
      </div>
    );
  }

  const { health } = result;
  const db = health.checks.database;
  return (
    <dl className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-3">
      <div>
        <dt className="text-xs text-muted">API</dt>
        <dd className="mt-1">
          <Badge tone={health.status === "ok" ? "success" : "danger"}>{health.status === "ok" ? "Opérationnelle" : "En panne"}</Badge>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Base de données</dt>
        <dd className="mt-1">
          <Badge tone={db.status === "ok" ? "success" : "danger"}>{db.status === "ok" ? `OK · ${db.latencyMs ?? "?"} ms` : "Injoignable"}</Badge>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Version</dt>
        <dd className="mt-1 font-mono text-sm">{health.version}</dd>
      </div>
    </dl>
  );
}

export default function StatusPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-8">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← Accueil
      </Link>
      <h1 className="mt-4 font-display text-3xl">État des services</h1>
      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-muted">Vérification en cours…</p>}>
          <ApiHealth />
        </Suspense>
      </div>
    </main>
  );
}
