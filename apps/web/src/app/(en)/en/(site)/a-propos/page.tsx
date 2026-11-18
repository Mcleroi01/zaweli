import { AboutPage, aboutMetadata } from "@/components/site/pages/about";

export const metadata = aboutMetadata("en");

export default function Page() {
  return <AboutPage locale="en" />;
}
