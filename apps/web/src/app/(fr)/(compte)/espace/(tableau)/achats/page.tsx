import { Suspense } from "react";
import { OrdersView } from "@/components/account/purchase";

/** Page privée, rendue dans le navigateur après connexion : pas de prérendu instantané à valider. */
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <OrdersView />
    </Suspense>
  );
}
