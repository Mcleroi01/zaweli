import { AuthShell } from "@/components/account/auth";

export default function AccessLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
