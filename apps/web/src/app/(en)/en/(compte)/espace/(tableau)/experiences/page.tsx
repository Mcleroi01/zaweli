import { Suspense } from "react";
import { ExperiencesView } from "@/components/account/dashboard";

/** Page privée, rendue dans le navigateur après connexion : pas de prérendu instantané à valider. */
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <ExperiencesView />
    </Suspense>
  );
}
