import type { Metadata } from "next";
import { DemoPage, demoMetadata, demoStaticParams } from "@/components/site/pages/demo";

export const generateStaticParams = demoStaticParams;

export async function generateMetadata({ params }: PageProps<"/modeles/[slug]/demo">): Promise<Metadata> {
  return demoMetadata("fr", (await params).slug);
}

export default async function Page({ params }: PageProps<"/modeles/[slug]/demo">) {
  return <DemoPage locale="fr" slug={(await params).slug} />;
}
