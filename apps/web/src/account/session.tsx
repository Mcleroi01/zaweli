"use client";

import type { Session } from "@supabase/supabase-js";
import type { Locale, ProfileResponse } from "@zaweli/shared-types";
import { usePathname, useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type AccountDictionary, getAccountDictionary } from "@/i18n/account";
import { localePath } from "@/i18n/routing";
import { type AccountApi, authConfigured, createAccountApi, getSupabase } from "./client";

type SessionState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "signed-in"; session: Session; profile: ProfileResponse | null };

type Account = {
  locale: Locale;
  t: AccountDictionary;
  api: AccountApi;
  state: SessionState;
  /** Chemin dans la langue de la page (/espace → /en/espace). */
  path: (p: string) => string;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AccountContext = createContext<Account | null>(null);

export function useAccount(): Account {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount hors de AccountProvider");
  return value;
}

/**
 * Session de l'espace client. Le navigateur ne détient que la session
 * Supabase ; toute donnée passe par l'API, qui vérifie le jeton à chaque appel.
 */
export function AccountProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = getAccountDictionary(locale);
  const api = useMemo(() => createAccountApi(locale), [locale]);
  const [state, setState] = useState<SessionState>({ kind: "loading" });

  const load = useCallback(
    async (session: Session | null) => {
      if (!session) return setState({ kind: "signed-out" });
      let profile: ProfileResponse | null = null;
      try {
        profile = await api.profile();
        // Compte tout juste créé via Google : il prend la langue de la page d'où il vient.
        const created = new Date(session.user.created_at).getTime();
        if (profile.locale !== locale && Date.now() - created < 10 * 60_000) profile = await api.updateProfile({ locale });
      } catch {
        // API injoignable : l'espace s'affiche quand même, chaque écran signale l'erreur.
      }
      setState({ kind: "signed-in", session, profile });
    },
    [api, locale],
  );

  useEffect(() => {
    if (!authConfigured) {
      queueMicrotask(() => setState({ kind: "signed-out" }));
      return;
    }
    const client = getSupabase();
    let alive = true;
    void client.auth.getSession().then(({ data }) => {
      if (alive) void load(data.session);
    });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === "SIGNED_OUT") setState({ kind: "signed-out" });
      if (event === "SIGNED_IN" || event === "USER_UPDATED") void load(session);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [load]);

  const value = useMemo<Account>(
    () => ({
      locale,
      t,
      api,
      state,
      path: (p) => localePath(locale, p),
      refreshProfile: async () => {
        if (state.kind === "signed-in") await load(state.session);
      },
      signOut: async () => {
        if (authConfigured) await getSupabase().auth.signOut();
        setState({ kind: "signed-out" });
      },
    }),
    [locale, t, api, state, load],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function FullPageStatus({ text }: { text: string }) {
  return (
    <div className="grid min-h-[60svh] place-items-center px-5" aria-busy="true">
      <p className="text-[0.95rem] text-muted">{text}</p>
    </div>
  );
}

/** Espace protégé : sans session, on part vers la connexion en gardant la destination. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { state, t, path } = useAccount();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (state.kind === "signed-out") router.replace(`${path("/connexion")}?next=${encodeURIComponent(pathname)}`);
  }, [state.kind, router, path, pathname]);
  if (state.kind !== "signed-in") return <FullPageStatus text={t.common.loading} />;
  return <>{children}</>;
}
