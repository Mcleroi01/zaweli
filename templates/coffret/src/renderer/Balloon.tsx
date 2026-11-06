/** Ballon gonflable brillant, dessiné en SVG. Repris de Pauline. */
export type BalloonTint = "red" | "gold" | "ivory";

const TINTS: Record<BalloonTint, [string, string, string]> = {
  red: ["#e0485c", "#a3182a", "#5e0a15"],
  gold: ["#fbe8b4", "#d9ac55", "#8f6322"],
  ivory: ["#ffffff", "#f1e6d2", "#c9b38d"],
};

export function Balloon({ tint = "red", id }: { tint?: BalloonTint; id: number }) {
  const [hi, mid, lo] = TINTS[tint];
  const g = `cf-bal-${id}`;
  return (
    <svg viewBox="0 0 100 170" className="h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        <radialGradient id={g} cx="34%" cy="30%" r="75%">
          <stop offset="0" stopColor={hi} />
          <stop offset="0.45" stopColor={mid} />
          <stop offset="1" stopColor={lo} />
        </radialGradient>
      </defs>
      <path d="M50 118 C 46 132, 56 140, 50 152 C 45 162, 54 166, 50 172" fill="none" stroke="#d9c49a" strokeOpacity="0.7" strokeWidth="1" />
      <path d="M50 4 C 79 4 95 28 95 55 C 95 86 71 110 52 114 L 48 114 C 29 110 5 86 5 55 C 5 28 21 4 50 4 Z" fill={`url(#${g})`} />
      <path d="M45 113 L 55 113 L 52 120 L 48 120 Z" fill={lo} />
      <ellipse cx="33" cy="30" rx="10" ry="17" transform="rotate(28 33 30)" fill="#fff" opacity="0.45" />
      <ellipse cx="29" cy="52" rx="3" ry="5" transform="rotate(20 29 52)" fill="#fff" opacity="0.3" />
    </svg>
  );
}
