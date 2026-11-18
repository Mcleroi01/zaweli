import type { Metadata } from "next";
import type { Locale } from "@zaweli/shared-types";
import { FaqList } from "@/components/site/faq-list";
import { SplitReveal } from "@/components/site/motion";
import { getDictionary } from "@/i18n/dictionaries";
import { alternatesFor } from "@/i18n/routing";

export function questionsMetadata(locale: Locale): Metadata {
  const t = getDictionary(locale).questions;
  return { title: t.title, description: t.description, alternates: alternatesFor(locale, "/questions") };
}

export function QuestionsPage({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.questions;
  return (
    <section className="pt-36 pb-28 sm:pt-44">
      <div className="mx-auto grid max-w-[84rem] gap-12 px-5 sm:px-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="kicker text-muted">{t.kicker}</p>
          <SplitReveal as="h1" immediate className="display mt-6 text-[clamp(3rem,6vw,5rem)]">
            {t.heading}
          </SplitReveal>
        </div>
        <div className="lg:col-span-7 lg:col-start-6">
          <FaqList items={dict.faq} />
        </div>
      </div>
    </section>
  );
}
