type ChapterMarkProps = {
  index: string;
  label: string;
  tone?: "light" | "dark";
  className?: string;
};

/** Repère éditorial de chapitre : « 02 —— Le chemin parcouru ». */
export default function ChapterMark({ index, label, tone = "dark", className = "" }: ChapterMarkProps) {
  const color = tone === "dark" ? "text-ec-gold/80" : "text-ec-bordeaux/70";
  const line = tone === "dark" ? "bg-ec-gold/40" : "bg-ec-bordeaux/30";
  return (
    <div className={`flex items-center gap-4 ${color} ${className}`} data-chapter>
      <span className="font-ec-serif text-lg italic">{index}</span>
      <span className={`h-px w-12 ${line}`} aria-hidden="true" />
      <span className="eyebrow">{label}</span>
    </div>
  );
}
