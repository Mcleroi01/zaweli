/**
 * Coordonnées publiques de Zaweli, utilisées par la page Contact et le pied de page.
 * Les boîtes doivent exister chez l'hébergeur de messagerie (Hostinger, domaine zaweli.store).
 */
export const CONTACT = {
  /** Questions générales, partenariats, entreprises. */
  general: "contact@zaweli.store",
  /** Aide sur une création, un lien, un paiement. */
  support: "support@zaweli.store",
} as const;

export const mailto = (address: string, subject?: string) =>
  `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
