"use client";

import { useEffect, useMemo, useState } from "react";

type Stats = { totals: { pageViews: number; redirects: number; uniqueViews: number; uniqueRedirects: number }; daily: { date: string; pageViews: number; redirects: number }[]; linkCount?: number };
type Preset = "7d" | "30d" | "90d" | "all" | "custom";

function range(preset: Preset, from: string, to: string) {
  const end = new Date();
  if (preset === "custom") return { from: new Date(from), to: new Date(to) };
  if (preset === "all") return { from: new Date("1970-01-01T00:00:00Z"), to: end };
  const days = Number(preset.slice(0, -1));
  return { from: new Date(end.getTime() - days * 86400000), to: end };
}

export function StatsDashboard({ scope, id }: { scope: "link" | "collection"; id: string }) {
  const [preset, setPreset] = useState<Preset>("30d");
  const [fromInput, setFromInput] = useState(""); const [toInput, setToInput] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const dates = useMemo(() => range(preset, fromInput, toInput), [preset, fromInput, toInput]);
  useEffect(() => {
    const path = scope === "link" ? `/api/links/${encodeURIComponent(id)}/stats` : `/api/collections/${encodeURIComponent(id)}/stats`;
    const qs = new URLSearchParams({ from: dates.from.toISOString(), to: dates.to.toISOString() });
    fetch(`${path}?${qs}`).then(r => r.ok ? r.json() : null).then(setStats);
  }, [scope, id, dates.from.getTime(), dates.to.getTime()]);
  return <section aria-label="Statistics">
    <div role="group" aria-label="Time frame">
      {(["7d", "30d", "90d", "all", "custom"] as Preset[]).map(p => <button type="button" key={p} aria-pressed={preset === p} onClick={() => setPreset(p)}>{p === "all" ? "All time" : p === "custom" ? "Custom" : `Last ${p.slice(0, -1)} days`}</button>)}
    </div>
    {preset === "custom" && <div><input type="date" value={fromInput} onChange={e => setFromInput(e.target.value)} /><input type="date" value={toInput} onChange={e => setToInput(e.target.value)} /></div>}
    {!stats ? <p>Loading statistics…</p> : <>
      {stats.linkCount !== undefined && <p>{stats.linkCount} links</p>}
      <p><strong>{stats.totals.pageViews}</strong> page views · <strong>{stats.totals.redirects}</strong> redirects</p>
      <p><strong>{stats.totals.uniqueViews}</strong> unique viewers · <strong>{stats.totals.uniqueRedirects}</strong> unique redirectors</p>
      <ul>{stats.daily.map(d => <li key={d.date}>{new Date(d.date).toLocaleDateString()}: {d.pageViews} views, {d.redirects} redirects</li>)}</ul>
    </>}
  </section>;
}
