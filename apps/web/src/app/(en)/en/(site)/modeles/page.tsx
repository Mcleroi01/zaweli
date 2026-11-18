import { ModelsPage, modelsMetadata } from "@/components/site/pages/models";

export const metadata = modelsMetadata("en");

export default function Page() {
  return <ModelsPage locale="en" />;
}
