import type { Metadata } from "next";
import { AccountProvider } from "@/account/session";
import { getAccountDictionary } from "@/i18n/account";

/** Espace client (en) : privÃ©, jamais indexÃ© ni mis en cache par le CDN (voir server.mjs). */
export const metadata: Metadata = {
  title: getAccountDictionary("en").meta.noindex,
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AccountProvider locale="en">{children}</AccountProvider>;
}
