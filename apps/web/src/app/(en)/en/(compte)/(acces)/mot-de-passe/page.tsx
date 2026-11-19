import { Suspense } from "react";
import { ResetView } from "@/components/account/auth";

/** Page privée, rendue dans le navigateur après connexion : pas de prérendu instantané à valider. */
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <ResetView />
    </Suspense>
  );
}
