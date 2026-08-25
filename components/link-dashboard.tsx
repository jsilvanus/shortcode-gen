"use client";

import { useMemo, useState } from "react";

type Collection = { id: string; name: string };
type Link = { id: string; code: string; targetUrl: string; isPrivate: boolean; expiresAt: string | null; collections: { collection: Collection }[] };

export function LinkDashboard({ links, collections }: { links: Link[]; collections: Collection[] }) {
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<"all" | "private" | "public">("all");
  const [collection, setCollection] = useState("all");
  const [assigning, setAssigning] = useState<string | null>(null);

  const filtered = useMemo(() => links.filter(link => {
    const q = query.toLowerCase();
    return (!q || link.code.toLowerCase().includes(q) || link.targetUrl.toLowerCase().includes(q)) &&
      (visibility === "all" || (visibility === "private" ? link.isPrivate : !link.isPrivate)) &&
      (collection === "all" || link.collections.some(x => x.collection.id === collection));
  }), [links, query, visibility, collection]);

  async function saveCollections(linkId: string, ids: string[]) {
    const link = links.find(l => l.id === linkId);
    if (!link) return;
    await fetch(`/api/links/${encodeURIComponent(link.code)}/collections`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collectionIds: ids }) });
    setAssigning(null);
  }

  return <main>
    <header><h1>Links</h1><input aria-label="Search links" placeholder="Search code or target…" value={query} onChange={e => setQuery(e.target.value)} /></header>
    <nav aria-label="Link filters">
      {(["all", "private", "public"] as const).map(value => <button key={value} type="button" aria-pressed={visibility === value} onClick={() => setVisibility(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
      <select aria-label="Filter by collection" value={collection} onChange={e => setCollection(e.target.value)}><option value="all">All collections</option>{collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    </nav>
    <section aria-label="Link list">
      {filtered.map(link => <article key={link.id}>
        <div><strong>{link.code}</strong> <span>{link.isPrivate ? "Private" : "Public"}</span></div>
        <div>{link.targetUrl}</div>
        <div aria-label="Collections">{link.collections.map(({ collection: c }) => <span key={c.id} style={{ display: "inline-block", marginRight: 6, padding: "2px 8px", border: "1px solid currentColor", borderRadius: 999 }}>{c.name}</span>)}</div>
        <button type="button" onClick={() => setAssigning(assigning === link.id ? null : link.id)}>Edit labels</button>
        {assigning === link.id && <CollectionAssignment link={link} collections={collections} onSave={ids => void saveCollections(link.id, ids)} />}
      </article>)}
      {!filtered.length && <p>No links match these filters.</p>}
    </section>
  </main>;
}

function CollectionAssignment({ link, collections, onSave }: { link: Link; collections: Collection[]; onSave: (ids: string[]) => void }) {
  const [selected, setSelected] = useState(link.collections.map(x => x.collection.id));
  return <fieldset><legend>Collections</legend>{collections.map(c => <label key={c.id} style={{ display: "block" }}><input type="checkbox" checked={selected.includes(c.id)} onChange={e => setSelected(v => e.target.checked ? [...v, c.id] : v.filter(id => id !== c.id))} /> {c.name}</label>)}<button type="button" onClick={() => onSave(selected)}>Save labels</button></fieldset>;
}
