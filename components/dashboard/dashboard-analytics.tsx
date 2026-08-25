"use client";

import { useEffect, useMemo, useState } from "react";

type LinkOption = { id: string; code: string; title?: string | null; isPrivate: boolean; active: boolean; expiresAt?: string | null; collectionIds: string[] };
type CollectionOption = { id: string; name: string; isPrivate: boolean };
type Stats = { exact: boolean; totals: { pageViews: number; redirects: number; uniqueViews: number; uniqueRedirects: number }; daily: { date: string; pageViews: number; redirects: number }[] };

const ranges = { "7d": 7, "30d": 30, "90d": 90, year: "year" } as const;

export function DashboardAnalytics({ links, collections }: { links: LinkOption[]; collections: CollectionOption[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [privateFilter, setPrivateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<keyof typeof ranges>("30d");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredLinks = useMemo(() => links.filter(link => {
    if (selectedCollection && !link.collectionIds.includes(selectedCollection)) return false;
    if (privateFilter === "private" && !link.isPrivate) return false;
    if (privateFilter === "public" && link.isPrivate) return false;
    if (statusFilter === "active" && !link.active) return false;
    if (statusFilter === "expired" && (!link.expiresAt || new Date(link.expiresAt) > new Date())) return false;
    const q = query.trim().toLowerCase();
    return !q || link.code.toLowerCase().includes(q) || (link.title ?? "").toLowerCase().includes(q);
  }), [links, selectedCollection, privateFilter, statusFilter, query]);

  const selectedLinks = useMemo(() => links.filter(l => selected.includes(l.id)), [links, selected]);

  function toggleLink(id: string) { setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]); }
  function selectFiltered() { setSelected(filteredLinks.map(l => l.id)); }
  function clearSelection() { setSelected([]); }

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
    <div className="collection-chips" aria-label="Collection filters">
      <button type="button" onClick={() => setSelectedCollection("")} aria-pressed={!selectedCollection}>All collections</button>
      {collections.map(c => <button type="button" key={c.id} onClick={() => setSelectedCollection(c.id)} aria-pressed={selectedCollection === c.id}>{c.name}</button>)}
    </div>
    <div>
      <label>Search <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Code or title" /></label>
      <label>Visibility <select value={privateFilter} onChange={e => setPrivateFilter(e.target.value)}><option value="all">All</option><option value="private">Private</option><option value="public">Public</option></select></label>
      <label>Status <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">All</option><option value="active">Active</option><option value="expired">Expired</option></select></label>
      <button type="button" onClick={selectFiltered}>Select filtered</button>
      <button type="button" onClick={clearSelection}>Clear</button>
    </div>
    <label>Time range <select value={range} onChange={e => setRange(e.target.value as keyof typeof ranges)}><option value="7d">7 days</option><option value="30d">30 days</option><option value="90d">90 days</option><option value="year">This year</option></select></label>
    <ul>{filteredLinks.map(link => <li key={link.id}><label><input type="checkbox" checked={selected.includes(link.id)} onChange={() => toggleLink(link.id)} /> {link.code}{link.title ? ` — ${link.title}` : ""} {link.isPrivate ? "(private)" : "(public)"}</label></li>)}</ul>
    {!selectedLinks.length && <p>Select one or more links to compare.</p>}
    {loading && <p>Loading statistics…</p>}
    {stats && <><p>{stats.exact ? "Exact unique visitor counts" : "Estimated unique visitor counts"}</p><div><strong>{stats.totals.pageViews}</strong> page views · <strong>{stats.totals.redirects}</strong> redirects</div><div><strong>{stats.totals.uniqueViews}</strong> unique viewers · <strong>{stats.totals.uniqueRedirects}</strong> unique redirectors</div><ul>{stats.daily.map(d => <li key={d.date}>{new Date(d.date).toLocaleDateString()}: {d.pageViews} views, {d.redirects} redirects</li>)}</ul></>}
  </section>;
}
