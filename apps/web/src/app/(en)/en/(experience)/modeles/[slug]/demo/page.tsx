import type { Metadata } from "next";
import { DemoPage, demoMetadata, demoStaticParams } from "@/components/site/pages/demo";

export const generateStaticParams = demoStaticParams;

export async function generateMetadata({ params }: PageProps<"/en/modeles/[slug]/demo">): Promise<Metadata> {
  return demoMetadata("en", (await params).slug);
}

export default async function Page({ params }: PageProps<"/en/modeles/[slug]/demo">) {
  return <DemoPage locale="en" slug={(await params).slug} />;
}
