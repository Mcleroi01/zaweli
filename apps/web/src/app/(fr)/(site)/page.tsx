import { HomePage, homeMetadata } from "@/components/site/pages/home";

export const metadata = homeMetadata("fr");

export default function Page() {
  return <HomePage locale="fr" />;
}
