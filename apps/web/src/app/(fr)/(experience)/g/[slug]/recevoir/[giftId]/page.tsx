import type { Metadata } from "next";
import { Suspense } from "react";
import { ClaimGift } from "@/components/claim/claim-gift";

/**
 * Réception d'un cadeau d'argent versé via Zaweli (docs/12) : page privée,
 * jamais indexée, rendue dans le navigateur (aucune donnée au prérendu).
 */
export const metadata: Metadata = {
  title: "Un cadeau t'attend",
  robots: { index: false, follow: false },
};

async function Claim({ params }: { params: Promise<{ slug: string; giftId: string }> }) {
  const { slug, giftId } = await params;
  return <ClaimGift slug={slug} giftId={giftId} />;
}

export default function ClaimPage({ params }: PageProps<"/g/[slug]/recevoir/[giftId]">) {
  return (
    <Suspense fallback={<main className="min-h-svh" aria-busy="true" />}>
      <Claim params={params} />
    </Suspense>
  );
}
