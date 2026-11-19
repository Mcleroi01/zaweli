import { Suspense } from "react";
import { LoginView } from "@/components/account/auth";

/** Page privée, rendue dans le navigateur après connexion : pas de prérendu instantané à valider. */
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
