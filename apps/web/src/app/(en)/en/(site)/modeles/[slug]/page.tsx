import type { Metadata } from "next";
import { ModelPage, modelMetadata, modelStaticParams } from "@/components/site/pages/model";

export const generateStaticParams = modelStaticParams;

export async function generateMetadata({ params }: PageProps<"/en/modeles/[slug]">): Promise<Metadata> {
  return modelMetadata("en", (await params).slug);
}

export default async function Page({ params }: PageProps<"/en/modeles/[slug]">) {
  return <ModelPage locale="en" slug={(await params).slug} />;
}
