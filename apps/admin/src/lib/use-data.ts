"use client";

import { useEffect, useEffectEvent, useState } from "react";

export type DataState<T> = {
  data: T | null;
  error: string | null;
  /** Rechargement en cours : l'écran garde les données précédentes, atténuées. */
  refreshing: boolean;
  reload: () => void;
};

/**
 * Charge une donnée et la recharge quand `key` change. Pendant le rechargement,
 * la donnée précédente reste affichée (pas de squelette, pas de saut de mise en page).
 */
export function useData<T>(key: string, load: () => Promise<T>): DataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [nonce, setNonce] = useState(0);
  // Toujours la dernière version de `load`, sans en faire une dépendance (seule `key` déclenche un rechargement).
  const run = useEffectEvent(() => load());

  useEffect(() => {
    let alive = true;
    queueMicrotask(() => alive && setRefreshing(true));
    run()
      .then((value) => {
        if (!alive) return;
        setData(value);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Erreur de chargement."))
      .finally(() => alive && setRefreshing(false));
    return () => {
      alive = false;
    };
  }, [key, nonce]);

  return { data, error, refreshing, reload: () => setNonce((n) => n + 1) };
}
