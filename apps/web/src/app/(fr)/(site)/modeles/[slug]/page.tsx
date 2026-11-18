import type { Metadata } from "next";
import { ModelPage, modelMetadata, modelStaticParams } from "@/components/site/pages/model";

export const generateStaticParams = modelStaticParams;

export async function generateMetadata({ params }: PageProps<"/modeles/[slug]">): Promise<Metadata> {
  return modelMetadata("fr", (await params).slug);
}

export default async function Page({ params }: PageProps<"/modeles/[slug]">) {
  return <ModelPage locale="fr" slug={(await params).slug} />;
}
