import { Suspense } from "react";
import { AccountShell } from "@/components/account/shell";

/** Le cadre lit l'adresse courante (onglet actif) : rendu dans le navigateur, sous Suspense. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AccountShell>{children}</AccountShell>
    </Suspense>
  );
}
