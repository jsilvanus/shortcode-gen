"use client";

import { useEffect, useState } from "react";

type Stats = { totals: { pageViews: number; redirects: number; uniqueViews: number; uniqueRedirects: number }; daily: { date: string; pageViews: number; redirects: number; uniqueViews: number; uniqueRedirects: number }[] };

export function LinkStats({ code }: { code: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => { fetch(`/api/links/${encodeURIComponent(code)}/stats`).then(r => r.ok ? r.json() : null).then(setStats); }, [code]);
  if (!stats) return <p>Loading statistics…</p>;
  return <section aria-label="Link statistics">
    <div><strong>{stats.totals.pageViews}</strong> page views · <strong>{stats.totals.redirects}</strong> redirects</div>
    <div><strong>{stats.totals.uniqueViews}</strong> unique viewers · <strong>{stats.totals.uniqueRedirects}</strong> unique redirectors</div>
    {stats.daily.length > 0 && <ul>{stats.daily.slice(-30).map(d => <li key={d.date}>{new Date(d.date).toLocaleDateString()}: {d.pageViews} views, {d.redirects} redirects</li>)}</ul>}
  </section>;
}
