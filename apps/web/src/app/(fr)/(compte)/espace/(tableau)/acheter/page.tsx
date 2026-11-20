import { Suspense } from "react";
import { PurchaseView } from "@/components/account/purchase";

/** Page privée, rendue dans le navigateur après connexion : pas de prérendu instantané à valider. */
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <PurchaseView />
    </Suspense>
  );
}
