"use client";

import { useEffect, useState } from "react";

type Stats = { exact: boolean; totals: { pageViews: number; redirects: number; uniqueViews: number; uniqueRedirects: number }; daily: { date: string; pageViews: number; redirects: number }[]; monthly: { year: number; month: number; uniqueViews: number; uniqueRedirects: number }[] };

const ranges = { "7d": 7, "30d": 30, "90d": 90, "year": "year" } as const;

export function LinkStats({ code }: { code: string }) {
  const [range, setRange] = useState<keyof typeof ranges>("30d");
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    const now = new Date();
    const days = ranges[range];
    const from = days === "year" ? new Date(Date.UTC(now.getUTCFullYear(), 0, 1)) : new Date(now.getTime() - Number(days) * 86400000);
    fetch(`/api/links/${encodeURIComponent(code)}/stats?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(now.toISOString())}`).then(r => r.ok ? r.json() : null).then(setStats);
  }, [code, range]);
  if (!stats) return <p>Loading statistics…</p>;
  return <section aria-label="Link statistics">
    <label>Time range <select value={range} onChange={e => setRange(e.target.value as keyof typeof ranges)}><option value="7d">7 days</option><option value="30d">30 days</option><option value="90d">90 days</option><option value="year">This year</option></select></label>
    <p>{stats.exact ? "Exact" : "Estimated unique visitor count"}</p>
    <div><strong>{stats.totals.pageViews}</strong> page views · <strong>{stats.totals.redirects}</strong> redirects</div>
    <div><strong>{stats.totals.uniqueViews}</strong> unique viewers · <strong>{stats.totals.uniqueRedirects}</strong> unique redirectors</div>
    {stats.daily.length > 0 && <ul>{stats.daily.slice(-30).map(d => <li key={d.date}>{new Date(d.date).toLocaleDateString()}: {d.pageViews} views, {d.redirects} redirects</li>)}</ul>}
    {stats.monthly.length > 0 && <ul>{stats.monthly.map(m => <li key={`${m.year}-${m.month}`}>{m.year}-{String(m.month).padStart(2, "0")}: ~{m.uniqueViews} unique views, ~{m.uniqueRedirects} unique redirects</li>)}</ul>}
  </section>;
}
