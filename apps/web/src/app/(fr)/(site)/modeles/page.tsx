import { ModelsPage, modelsMetadata } from "@/components/site/pages/models";

export const metadata = modelsMetadata("fr");

export default function Page() {
  return <ModelsPage locale="fr" />;
}
