import { AdminProviders } from "@/components/providers";
import { Shell } from "@/components/shell";

/** Toutes les pages de l'administration : accès vérifié, puis navigation. */
export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <AdminProviders>
      <Shell>{children}</Shell>
    </AdminProviders>
  );
}
