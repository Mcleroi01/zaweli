import { HomePage, homeMetadata } from "@/components/site/pages/home";

export const metadata = homeMetadata("en");

export default function Page() {
  return <HomePage locale="en" />;
}
