/** Liste de questions dépliables, accessible sans JavaScript (details / summary). */
export function FaqList({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <div className="border-t border-line">
      {items.map((item) => (
        <details key={item.q} className="group border-b border-line">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 text-left [&::-webkit-details-marker]:hidden">
            <span className="display text-[1.35rem] leading-snug sm:text-[1.55rem]">{item.q}</span>
            <span
              aria-hidden="true"
              className="relative mt-2 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line transition-colors group-open:border-primary group-open:bg-primary"
            >
              <span className="absolute h-px w-2.5 bg-ink group-open:bg-paper" />
              <span className="absolute h-2.5 w-px bg-ink transition-transform duration-300 group-open:scale-y-0" />
            </span>
          </summary>
          <p className="max-w-2xl pb-7 text-[1.02rem] leading-relaxed text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
