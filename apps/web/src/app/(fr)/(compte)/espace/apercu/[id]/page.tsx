import { Suspense } from "react";
import { PreviewView } from "@/components/account/preview";

/** Aperçu privé d'un brouillon, rendu dans le navigateur après connexion. */
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <PreviewView />
    </Suspense>
  );
}
