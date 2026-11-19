import { Suspense } from "react";
import { CreateStartView } from "@/components/account/create";

/** Page privée, rendue dans le navigateur après connexion : pas de prérendu instantané à valider. */
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <CreateStartView />
    </Suspense>
  );
}
