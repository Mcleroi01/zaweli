import { QuestionsPage, questionsMetadata } from "@/components/site/pages/questions";

export const metadata = questionsMetadata("fr");

export default function Page() {
  return <QuestionsPage locale="fr" />;
}
