"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type { MeResponse } from "@zaweli/shared-types";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type AdminApi, ApiRequestError, createHttpApi } from "@/lib/api";
import { DEMO_MODE, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { browserTimeZone, type Period, type PresetId, presetRange } from "@/lib/range";
import { LoginScreen, StatusScreen } from "./login";

type Admin = {
  api: AdminApi;
  me: MeResponse;
  tz: string;
  demo: boolean;
  period: Period;
  setPeriod: (period: Period) => void;
  signOut: () => Promise<void>;
};

const AdminContext = createContext<Admin | null>(null);

export function useAdmin(): Admin {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin hors de AdminProviders");
  return value;
}

const PERIOD_KEY = "zw-admin-period";

/** Période choisie : souvenir propre à ce navigateur (simple confort), recalculée à chaque visite. */
function initialPeriod(tz: string): Period {
  try {
    const saved = JSON.parse(localStorage.getItem(PERIOD_KEY) ?? "null") as Period | null;
    if (saved?.preset === "custom" && saved.from && saved.to) return saved;
    if (saved?.preset) return { preset: saved.preset, ...presetRange(saved.preset as Exclude<PresetId, "custom">, tz) };
  } catch {
    // Stockage indisponible (navigation privée…) : valeur par défaut.
  }
  return { preset: "30d", ...presetRange("30d", tz) };
}

let supabase: SupabaseClient | null = null;
const getSupabase = () => (supabase ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } }));

type State =
  | { kind: "loading" }
  | { kind: "signed-out"; message?: string }
  | { kind: "forbidden"; email: string | null }
  | { kind: "error"; message: string }
  | { kind: "ready"; api: AdminApi; me: MeResponse };

/** Qui regarde, et a-t-il le droit d'entrer ? (aucun effet de bord sur l'écran) */
async function resolveAccess(tz: string): Promise<State> {
  // Condition écrite ici en entier (et non via DEMO_MODE) : webpack l'évalue au build et, en production,
  // supprime la branche ET le fichier du générateur du code livré.
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ADMIN_DEMO === "1") {
    const { createDemoApi } = await import("@/lib/demo");
    const api = createDemoApi(tz);
    return { kind: "ready", api, me: await api.me() };
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { kind: "error", message: "Configuration manquante : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY." };
  }
  const client = getSupabase();
  const { data } = await client.auth.getSession();
  if (!data.session) return { kind: "signed-out" };
  const api = createHttpApi(async () => (await client.auth.getSession()).data.session?.access_token ?? null);
  try {
    const me = await api.me();
    return me.roles.includes("admin") ? { kind: "ready", api, me } : { kind: "forbidden", email: me.email };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) return { kind: "signed-out", message: error.message };
    return { kind: "error", message: error instanceof Error ? `API injoignable : ${error.message}` : "API injoignable." };
  }
}

/**
 * Accès à l'administration : session Supabase, puis GET /v1/me. Seul un rôle
 * « admin » lu EN BASE par l'API ouvre l'espace ; l'API le revérifie à chaque appel,
 * cet écran n'est donc qu'un confort, pas la protection.
 */
export function AdminProviders({ children }: { children: ReactNode }) {
  const [tz] = useState(browserTimeZone);
  const [state, setState] = useState<State>({ kind: "loading" });
  // Rien de cela n'est affiché avant la vérification de l'accès (côté navigateur) : pas d'écart d'hydratation.
  const [period, setPeriodState] = useState<Period>(() => initialPeriod(tz));

  const setPeriod = useCallback((next: Period) => {
    setPeriodState(next);
    try {
      localStorage.setItem(PERIOD_KEY, JSON.stringify(next));
    } catch {
      // Sans stockage, la période vaut pour cette visite seulement.
    }
  }, []);

  useEffect(() => {
    let alive = true;
    // L'état n'est mis à jour qu'à la réponse (jamais dans le corps de l'effet).
    const refresh = () => void resolveAccess(tz).then((next) => alive && setState(next));
    refresh();
    const subscription =
      !DEMO_MODE && SUPABASE_URL && SUPABASE_ANON_KEY
        ? getSupabase().auth.onAuthStateChange((event) => {
            if (event === "SIGNED_IN" || event === "SIGNED_OUT") refresh();
          }).data.subscription
        : null;
    return () => {
      alive = false;
      subscription?.unsubscribe();
    };
  }, [tz]);

  const signOut = useCallback(async () => {
    if (!DEMO_MODE) await getSupabase().auth.signOut();
    setState({ kind: "signed-out" });
  }, []);

  const value = useMemo<Admin | null>(
    () => (state.kind === "ready" ? { api: state.api, me: state.me, tz, demo: DEMO_MODE, period, setPeriod, signOut } : null),
    [state, tz, period, setPeriod, signOut],
  );

  if (state.kind === "loading") return <StatusScreen title="Vérification de l'accès…" />;
  if (state.kind === "error") return <StatusScreen title="Administration indisponible" text={state.message} />;
  if (state.kind === "forbidden")
    return (
      <StatusScreen
        title="Accès réservé"
        text={`Le compte ${state.email ?? ""} n'a pas le rôle administrateur. Demandez-le à un administrateur existant.`}
        action={{ label: "Changer de compte", onClick: signOut }}
      />
    );
  if (state.kind === "signed-out") return <LoginScreen message={state.message} getClient={getSupabase} />;
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}
