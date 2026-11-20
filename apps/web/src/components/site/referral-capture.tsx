"use client";

import { REFERRAL_PARAM, referralCodeSchema } from "@zaweli/shared-types";
import { useEffect } from "react";

/** Clé locale du code de parrainage reçu par lien (gardé 30 jours, jusqu'à l'inscription). */
export const REFERRAL_STORAGE_KEY = "zw:ref";
const TTL_MS = 30 * 86_400_000;

export function readStoredReferral(): string | null {
  try {
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw) as { code?: string; at?: number };
    if (!code || !at || Date.now() - at > TTL_MS) {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearStoredReferral() {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // Stockage indisponible : rien à effacer.
  }
}

/**
 * Lit « ?parrain=CODE » sur n'importe quelle page du site et le garde en
 * local. L'espace client le transmet à l'API après l'inscription.
 */
export function ReferralCapture() {
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get(REFERRAL_PARAM);
    const parsed = referralCodeSchema.safeParse(raw ?? "");
    if (!parsed.success) return;
    try {
      localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({ code: parsed.data, at: Date.now() }));
    } catch {
      // Navigation privée : le parrainage ne sera simplement pas retenu.
    }
  }, []);
  return null;
}
