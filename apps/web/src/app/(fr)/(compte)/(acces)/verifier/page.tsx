import { Suspense } from "react";
import { VerifyView } from "@/components/account/auth";

/** Page privée, rendue dans le navigateur après connexion : pas de prérendu instantané à valider. */
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <VerifyView />
    </Suspense>
  );
}
