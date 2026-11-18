import { PricingPage, pricingMetadata } from "@/components/site/pages/pricing";

export const metadata = pricingMetadata("fr");

export default function Page() {
  return <PricingPage locale="fr" />;
}
