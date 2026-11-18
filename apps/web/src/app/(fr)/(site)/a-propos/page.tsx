import { AboutPage, aboutMetadata } from "@/components/site/pages/about";

export const metadata = aboutMetadata("fr");

export default function Page() {
  return <AboutPage locale="fr" />;
}
