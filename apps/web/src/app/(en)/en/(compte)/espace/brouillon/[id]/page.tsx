import { Suspense } from "react";
import { WizardView } from "@/components/account/wizard";

/** Page privée, rendue dans le navigateur après connexion : pas de prérendu instantané à valider. */
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <WizardView />
    </Suspense>
  );
}
