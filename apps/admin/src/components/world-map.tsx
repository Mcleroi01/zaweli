"use client";

import { type GeoPermissibleObjects, geoEqualEarth, geoPath } from "d3-geo";
import countries from "i18n-iso-countries";
import { type MouseEvent, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import { countryName } from "@/lib/format";

const WIDTH = 960;
const HEIGHT = 470;

/** Formes sans code numérique ISO dans Natural Earth : seule celle qui a un code reçu par l'API est rattachée. */
const BY_NAME: Record<string, string> = { Kosovo: "XK" };

type Shape = { code: string | null; name: string; d: string };

function buildShapes(): Shape[] {
  const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  type CountryFeature = { type: "Feature"; id?: string; properties: { name: string }; geometry: unknown };
  const collection = feature(topo, topo.objects.countries) as unknown as { features: CountryFeature[] };
  // L'Antarctique occupe un tiers de la carte sans jamais porter de donnée : retiré.
  const features = collection.features.filter((f) => f.id !== "010");
  const projection = geoEqualEarth().fitExtent(
    [
      [4, 4],
      [WIDTH - 4, HEIGHT - 4],
    ],
    { type: "FeatureCollection", features } as unknown as Parameters<ReturnType<typeof geoEqualEarth>["fitExtent"]>[1],
  );
  const path = geoPath(projection);
  return features.map((f) => ({
    code: (f.id ? countries.numericToAlpha2(f.id) : undefined) ?? BY_NAME[f.properties.name] ?? null,
    name: f.properties.name,
    d: path(f as unknown as GeoPermissibleObjects) ?? "",
  }));
}

/** Projection calculée une seule fois (formes fixes, indépendantes des données). */
let SHAPES: Shape[] | null = null;
const getShapes = () => (SHAPES ??= buildShapes());

/** Seuils « ronds » pour la rampe séquentielle (6 marches au-dessus de zéro). */
function thresholds(max: number): number[] {
  if (max <= 0) return [];
  const steps = 6;
  const raw = Array.from({ length: steps - 1 }, (_, i) => max ** ((i + 1) / steps));
  const nice = (n: number) => {
    const p = 10 ** Math.floor(Math.log10(n));
    const m = n / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  };
  return [...new Set(raw.map((n) => Math.max(1, nice(n))))].filter((n) => n < max);
}

export type MapValue = { value: number; display: string; lines?: string[] };

export function WorldMap({ values, metricLabel }: { values: Map<string, MapValue>; metricLabel: string }) {
  const shapes = getShapes();
  const max = Math.max(0, ...[...values.values()].map((v) => v.value));
  const steps = thresholds(max);
  /** Tranche b (0 = sous le premier seuil) → marche b + 1 de la rampe ; zéro reste neutre. */
  const colorOf = (v: number | undefined) => {
    if (!v) return "var(--seq-0)";
    const i = steps.findIndex((t) => v < t);
    return `var(--seq-${(i === -1 ? steps.length : i) + 1})`;
  };
  const [hover, setHover] = useState<{ shape: Shape; x: number; y: number; flip: boolean } | null>(null);

  const onMove = (shape: Shape) => (e: MouseEvent<SVGPathElement>) => {
    const box = (e.currentTarget.ownerSVGElement?.parentElement as HTMLElement).getBoundingClientRect();
    setHover({ shape, x: e.clientX - box.left, y: e.clientY - box.top, flip: e.clientX - box.left > box.width / 2 });
  };
  const hovered = hover?.shape.code ? values.get(hover.shape.code) : undefined;
  // Une case par tranche : 0, puis [1, s0[, [s0, s1[, …, ≥ dernier seuil.
  const fr = (n: number) => n.toLocaleString("fr-FR");
  const legend = [
    { label: "0 / aucune donnée", color: "var(--seq-0)" },
    ...(max > 0
      ? [
          { label: steps.length ? `< ${fr(steps[0]!)}` : "> 0", color: "var(--seq-1)" },
          ...steps.map((t, i) => ({ label: `≥ ${fr(t)}`, color: `var(--seq-${i + 2})` })),
        ]
      : []),
  ];

  return (
    <div>
      <div className="relative w-full" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={`Carte du monde : ${metricLabel} par pays. Les valeurs sont dans le tableau.`}>
          <rect width={WIDTH} height={HEIGHT} fill="transparent" />
          {shapes.map((s, i) => (
            <path
              key={`${s.code ?? s.name}-${i}`}
              d={s.d}
              fill={colorOf(s.code ? values.get(s.code)?.value : undefined)}
              stroke="var(--chart-surface)"
              strokeWidth={0.6}
              onMouseMove={onMove(s)}
              className="transition-[filter] hover:brightness-110"
              style={hover?.shape === s ? { stroke: "var(--zw-ink)", strokeWidth: 1.2 } : undefined}
            />
          ))}
        </svg>
        {hover && (
          <div
            className="pointer-events-none absolute z-10 min-w-40 rounded-lg border border-line bg-surface px-3 py-2 text-[0.8rem] shadow-lg"
            style={{ left: hover.x + 14, top: hover.y + 14, transform: hover.flip ? "translateX(calc(-100% - 28px))" : undefined }}
          >
            <p className="text-muted">{hover.shape.code ? countryName(hover.shape.code) : hover.shape.name}</p>
            <p className="mt-0.5">
              <strong className="tabular text-ink">{hovered?.display ?? "0"}</strong> <span className="text-ink-2">{metricLabel.toLowerCase()}</span>
            </p>
            {hovered?.lines?.map((l) => (
              <p key={l} className="text-ink-2">
                {l}
              </p>
            ))}
          </div>
        )}
      </div>
      <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.75rem] text-muted" aria-label={`Légende : ${metricLabel}`}>
        {legend.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3 w-6 rounded-sm ring-1 ring-line" style={{ background: item.color }} />
            <span className="tabular">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
