"use client";

import { useEffect, useMemo, useState } from "react";

type LinkOption = { id: string; code: string; title?: string | null };
type Stats = { exact: boolean; totals: { pageViews: number; redirects: number; uniqueViews: number; uniqueRedirects: number }; daily: { date: string; pageViews: number; redirects: number }[] };

const ranges = { "7d": 7, "30d": 30, "90d": 90, year: "year" } as const;

export function DashboardAnalytics({ links }: { links: LinkOption[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [range, setRange] = useState<keyof typeof ranges>("30d");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const selectedLinks = useMemo(() => links.filter(l => selected.includes(l.id)), [links, selected]);

  useEffect(() => {
    if (!selectedLinks.length) { setStats(null); return; }
    const now = new Date(); const value = ranges[range];
    const from = value === "year" ? new Date(Date.UTC(now.getUTCFullYear(), 0, 1)) : new Date(now.getTime() - Number(value) * 86400000);
    setLoading(true);
    fetch(`/api/dashboard/stats?ids=${encodeURIComponent(selected.join(","))}&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(now.toISOString())}`)
      .then(r => r.ok ? r.json() : null).then(setStats).finally(() => setLoading(false));
  }, [selected, selectedLinks.length, range]);

  return <section aria-label="Dashboard analytics">
    <h2>Statistics</h2>
    <label>Time range <select value={range} onChange={e => setRange(e.target.value as keyof typeof ranges)}><option value="7d">7 days</option><option value="30d">30 days</option><option value="90d">90 days</option><option value="year">This year</option></select></label>
    <div><strong>Links</strong> {links.map(link => <label key={link.id} style={{ marginLeft: 8 }}><input type="checkbox" checked={selected.includes(link.id)} onChange={e => setSelected(s => e.target.checked ? [...s, link.id] : s.filter(id => id !== link.id))} /> {link.code}</label>)}</div>
    {!selectedLinks.length && <p>Select one or more links to compare.</p>}
    {loading && <p>Loading statistics…</p>}
    {stats && <><p>{stats.exact ? "Exact unique visitor counts" : "Estimated unique visitor counts"}</p><div><strong>{stats.totals.pageViews}</strong> page views · <strong>{stats.totals.redirects}</strong> redirects</div><div><strong>{stats.totals.uniqueViews}</strong> unique viewers · <strong>{stats.totals.uniqueRedirects}</strong> unique redirectors</div><ul>{stats.daily.map(d => <li key={d.date}>{new Date(d.date).toLocaleDateString()}: {d.pageViews} views, {d.redirects} redirects</li>)}</ul></>}
  </section>;
}
