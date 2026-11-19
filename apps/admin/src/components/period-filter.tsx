"use client";

import { useState } from "react";
import { formatDay } from "@/lib/format";
import { addDays, daysBetween, PRESETS, type PresetId, presetRange, today } from "@/lib/range";
import { useAdmin } from "./providers";

/** Période d'analyse : une seule, au-dessus de tout le contenu qu'elle concerne. */
export function PeriodFilter() {
  const { period, setPeriod, tz } = useAdmin();
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const max = today(tz);
  const tooLong = daysBetween(from, to) > 400;
  const invalid = !from || !to || from > to || tooLong;

  const choose = (preset: PresetId) => {
    if (preset === "custom") {
      setPeriod({ preset, from, to });
      return;
    }
    const range = presetRange(preset, tz);
    setFrom(range.from);
    setTo(range.to);
    setPeriod({ preset, ...range });
  };

  const field = "h-9 rounded-lg border border-line bg-surface px-2 text-[0.85rem] outline-none focus:border-ink-2";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="period">
        Période
      </label>
      <select id="period" value={period.preset} onChange={(e) => choose(e.target.value as PresetId)} className={`${field} pr-7`}>
        {PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      {period.preset === "custom" ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!invalid) setPeriod({ preset: "custom", from, to });
          }}
        >
          <input type="date" aria-label="Du" value={from} max={to || max} min={addDays(to || max, -400)} onChange={(e) => setFrom(e.target.value)} className={field} />
          <span className="text-muted">→</span>
          <input type="date" aria-label="Au" value={to} max={max} min={from} onChange={(e) => setTo(e.target.value)} className={field} />
          <button type="submit" disabled={invalid} className="h-9 rounded-lg bg-accent px-3 text-[0.85rem] text-accent-ink disabled:opacity-50">
            Appliquer
          </button>
          {tooLong && <span className="text-[0.8rem] text-bad">400 jours au plus</span>}
        </form>
      ) : (
        <span className="text-[0.82rem] text-muted tabular">
          {formatDay(period.from)} → {formatDay(period.to)} · {tz}
        </span>
      )}
    </div>
  );
}
