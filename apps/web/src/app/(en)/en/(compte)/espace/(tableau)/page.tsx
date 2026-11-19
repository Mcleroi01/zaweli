import { Suspense } from "react";
import { OverviewView } from "@/components/account/dashboard";

/** Page privée, rendue dans le navigateur après connexion : pas de prérendu instantané à valider. */
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <OverviewView />
    </Suspense>
  );
}
