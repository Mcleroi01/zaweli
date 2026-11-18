import { ContactPage, contactMetadata } from "@/components/site/pages/contact";

export const metadata = contactMetadata("fr");

export default function Page() {
  return <ContactPage locale="fr" />;
}
