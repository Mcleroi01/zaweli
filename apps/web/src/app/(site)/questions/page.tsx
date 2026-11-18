import type { Metadata } from "next";
import { faq } from "@/content/faq";
import { FaqList } from "@/components/site/faq-list";
import { SplitReveal } from "@/components/site/motion";

export const metadata: Metadata = {
  title: "Questions",
  description: "Les réponses aux questions fréquentes sur Zaweli.",
  alternates: { canonical: "/questions" },
};

export default function QuestionsPage() {
  return (
    <section className="pt-36 pb-28 sm:pt-44">
      <div className="mx-auto grid max-w-[84rem] gap-12 px-5 sm:px-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="kicker text-muted">(Questions)</p>
          <SplitReveal as="h1" immediate className="display mt-6 text-[clamp(3rem,6vw,5rem)]">
            Les <em>réponses</em>, simplement.
          </SplitReveal>
        </div>
        <div className="lg:col-span-7 lg:col-start-6">
          <FaqList items={faq} />
        </div>
      </div>
    </section>
  );
}
