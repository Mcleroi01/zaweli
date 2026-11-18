import { PricingPage, pricingMetadata } from "@/components/site/pages/pricing";

export const metadata = pricingMetadata("en");

export default function Page() {
  return <PricingPage locale="en" />;
}
