import { QuestionsPage, questionsMetadata } from "@/components/site/pages/questions";

export const metadata = questionsMetadata("en");

export default function Page() {
  return <QuestionsPage locale="en" />;
}
